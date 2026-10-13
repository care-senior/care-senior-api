import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { StaffRole, UserRole } from '../src/common/enums/index.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const FEEDBACK = '/api/v1/feedback';

describe('Feedback (e2e)', () => {
  let testApp: TestApp;
  let clinicId: string;
  let otherClinicId: string;
  let coordinator: { id: string };
  let caregiver: { id: string };
  let otherClinicNurse: { id: string };
  let family: { id: string };
  const http = () => request(testApp.app.getHttpServer());
  const sign = (payload: object) =>
    new JwtService({ secret: process.env.JWT_SECRET }).sign(payload);
  const asStaff = (
    staff: { id: string },
    staffRole: StaffRole,
    staffClinicId = clinicId,
  ) =>
    `Bearer ${sign({ sub: staff.id, role: UserRole.STAFF, staffRole, clinicId: staffClinicId })}`;
  const asCoordinator = () => asStaff(coordinator, StaffRole.COORDINATOR);
  const asCaregiver = () => asStaff(caregiver, StaffRole.CAREGIVER);
  const asOtherClinicNurse = () =>
    asStaff(otherClinicNurse, StaffRole.NURSE, otherClinicId);
  const asGuardian = (guardian: { id: string }) =>
    `Bearer ${sign({ sub: guardian.id, role: UserRole.GUARDIAN })}`;

  async function send(authorization: string, body: object) {
    const response = await http()
      .post(FEEDBACK)
      .set('Authorization', authorization)
      .send(body)
      .expect(201);
    return response.body as { id: string };
  }

  async function listed(authorization: string, query: object = {}) {
    const response = await http()
      .get(FEEDBACK)
      .query(query)
      .set('Authorization', authorization)
      .expect(200);
    return (response.body.data as { id: string }[]).map(({ id }) => id);
  }

  beforeEach(async () => {
    testApp = await createTestApp();
    clinicId = await testApp.createClinic();
    otherClinicId = await testApp.createClinic({ name: 'Other E2E Clinic' });
    coordinator = await testApp.createStaffMember({
      clinicId,
      staffRole: StaffRole.COORDINATOR,
    });
    caregiver = await testApp.createStaffMember({
      clinicId,
      staffRole: StaffRole.CAREGIVER,
    });
    otherClinicNurse = await testApp.createStaffMember({
      clinicId: otherClinicId,
      staffRole: StaffRole.NURSE,
    });
    family = await testApp.createGuardian();
    await testApp.createResident({ clinicId, guardianIds: [family.id] });
    await testApp.createResident({
      clinicId: otherClinicId,
      guardianIds: [family.id],
    });
  });

  afterEach(async () => {
    await testApp.close();
  });

  it('records the author from the account', async () => {
    const response = await http()
      .post(FEEDBACK)
      .set('Authorization', asCaregiver())
      .send({ rating: 5, message: 'O app facilita o plantão.' })
      .expect(201);

    expect(response.body).toEqual({
      id: expect.any(String),
      authorId: caregiver.id,
      authorName: 'E2E Staff',
      authorRole: 'staff',
      rating: 5,
      message: 'O app facilita o plantão.',
      sentAt: expect.any(String),
    });
    for (const invalid of [
      { rating: 0, message: 'Ruim' },
      { rating: 6, message: 'Ótimo' },
      { rating: 4.5, message: 'Bom' },
      { rating: 4, message: '' },
      { rating: 4, message: 'Bom', authorName: 'Outra pessoa' },
    ]) {
      await http()
        .post(FEEDBACK)
        .set('Authorization', asCaregiver())
        .send(invalid)
        .expect(400);
    }
  });

  it("shows each clinic the feedback of its staff and of its residents' families", async () => {
    const fromStaff = await send(asCaregiver(), {
      rating: 4,
      message: 'Falta modo escuro.',
    });
    const fromFamily = await send(asGuardian(family), {
      rating: 5,
      message: 'Acompanho tudo de longe.',
    });
    const unlinkedFamily = await testApp.createGuardian();
    await testApp.createResident({ guardianIds: [unlinkedFamily.id] });
    await send(asGuardian(unlinkedFamily), {
      rating: 3,
      message: 'Ainda procurando clínica.',
    });

    expect(await listed(asCoordinator())).toEqual([
      fromFamily.id,
      fromStaff.id,
    ]);
    expect(await listed(asCoordinator(), { authorRole: 'guardian' })).toEqual([
      fromFamily.id,
    ]);
    expect(await listed(asOtherClinicNurse())).toEqual([fromFamily.id]);
  });

  it('lets only coordinators and nurses read it, in their own clinic', async () => {
    await http().get(FEEDBACK).set('Authorization', asCaregiver()).expect(403);
    await http()
      .get(FEEDBACK)
      .set('Authorization', asGuardian(family))
      .expect(403);
    await http()
      .get(FEEDBACK)
      .query({ clinicId: otherClinicId })
      .set('Authorization', asCoordinator())
      .expect(403);
  });
});
