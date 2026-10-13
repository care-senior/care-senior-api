import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { StaffRole, UserRole } from '../src/common/enums/index.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const MESSAGES = '/api/v1/messages';

describe('Messages (e2e)', () => {
  let testApp: TestApp;
  let clinicId: string;
  let otherClinicId: string;
  let caregiver: { id: string };
  let otherClinicNurse: { id: string };
  let mariaFamily: { id: string };
  let joseFamily: { id: string };
  let mariaId: string;
  let joseId: string;
  const http = () => request(testApp.app.getHttpServer());
  const sign = (payload: object) =>
    new JwtService({ secret: process.env.JWT_SECRET }).sign(payload);
  const asStaff = (
    staff: { id: string },
    staffRole: StaffRole,
    staffClinicId = clinicId,
  ) =>
    `Bearer ${sign({ sub: staff.id, role: UserRole.STAFF, staffRole, clinicId: staffClinicId })}`;
  const asCaregiver = () => asStaff(caregiver, StaffRole.CAREGIVER);
  const asOtherClinicNurse = () =>
    asStaff(otherClinicNurse, StaffRole.NURSE, otherClinicId);
  const asGuardian = (guardian: { id: string }) =>
    `Bearer ${sign({ sub: guardian.id, role: UserRole.GUARDIAN })}`;
  const send = (authorization: string, residentId: string, text: string) =>
    http()
      .post(MESSAGES)
      .set('Authorization', authorization)
      .send({ residentId, text });

  beforeEach(async () => {
    testApp = await createTestApp();
    clinicId = await testApp.createClinic();
    otherClinicId = await testApp.createClinic({ name: 'Other E2E Clinic' });
    caregiver = await testApp.createStaffMember({
      clinicId,
      staffRole: StaffRole.CAREGIVER,
    });
    otherClinicNurse = await testApp.createStaffMember({
      clinicId: otherClinicId,
      staffRole: StaffRole.NURSE,
    });
    mariaFamily = await testApp.createGuardian();
    joseFamily = await testApp.createGuardian();
    mariaId = await testApp.createResident({
      name: 'Maria Aparecida',
      clinicId,
      guardianIds: [mariaFamily.id],
    });
    joseId = await testApp.createResident({
      name: 'José Carlos',
      clinicId,
      guardianIds: [joseFamily.id],
    });
  });

  afterEach(async () => {
    await testApp.close();
  });

  it('lets the family and the clinic exchange messages about a resident', async () => {
    const fromFamily = await send(
      asGuardian(mariaFamily),
      mariaId,
      'Vou chegar atrasada na visita',
    ).expect(201);
    expect(fromFamily.body).toMatchObject({
      residentId: mariaId,
      senderId: mariaFamily.id,
      senderRole: 'guardian',
      senderName: 'E2E Guardian',
    });
    const fromClinic = await send(
      asCaregiver(),
      mariaId,
      'Sem problemas, ela está no jardim',
    ).expect(201);
    expect(fromClinic.body).toMatchObject({
      senderId: caregiver.id,
      senderRole: 'staff',
      senderName: 'E2E Staff',
    });

    const thread = await http()
      .get(MESSAGES)
      .query({ residentId: mariaId })
      .set('Authorization', asGuardian(mariaFamily))
      .expect(200);
    expect(thread.body.data.map(({ id }: { id: string }) => id)).toEqual([
      fromClinic.body.id,
      fromFamily.body.id,
    ]);
  });

  it('keeps each family and each clinic in their own conversations', async () => {
    await send(asGuardian(mariaFamily), mariaId, 'Oi').expect(201);
    await send(asGuardian(joseFamily), joseId, 'Olá').expect(201);

    const forMariaFamily = await http()
      .get(MESSAGES)
      .set('Authorization', asGuardian(mariaFamily))
      .expect(200);
    expect(forMariaFamily.body.meta.total).toBe(1);
    const forClinic = await http()
      .get(MESSAGES)
      .set('Authorization', asCaregiver())
      .expect(200);
    expect(forClinic.body.meta.total).toBe(2);

    await send(asGuardian(mariaFamily), joseId, 'Intruso').expect(403);
    await send(asOtherClinicNurse(), mariaId, 'Intruso').expect(403);
    await http()
      .get(MESSAGES)
      .query({ residentId: mariaId })
      .set('Authorization', asOtherClinicNurse())
      .expect(403);
  });

  it('refuses unlinked residents and empty or forged messages', async () => {
    const unlinkedResidentId = await testApp.createResident({
      guardianIds: [mariaFamily.id],
    });

    await send(asGuardian(mariaFamily), unlinkedResidentId, 'Oi').expect(409);
    await send(asGuardian(mariaFamily), mariaId, '').expect(400);
    await http()
      .post(MESSAGES)
      .set('Authorization', asGuardian(mariaFamily))
      .send({ residentId: mariaId, text: 'Oi', senderName: 'Coordenação' })
      .expect(400);
  });
});
