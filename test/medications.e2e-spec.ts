import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { StaffRole, UserRole } from '../src/common/enums/index.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const MEDICATIONS = '/api/v1/medications';
const ACTIVITIES = '/api/v1/activities';

describe('Medications (e2e)', () => {
  let testApp: TestApp;
  let clinicId: string;
  let otherClinicId: string;
  let caregiver: { id: string };
  let otherClinicNurse: { id: string };
  let mariaFamily: { id: string };
  let beneditoFamily: { id: string };
  let mariaId: string;
  let beneditoId: string;
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
  const losartana = (residentId: string) => ({
    residentId,
    name: 'Losartana',
    dosage: '50mg',
    form: 'tablet',
    frequency: '1x ao dia, pela manhã',
    instructions: 'Tomar em jejum',
    prescribedBy: 'Dr. Paulo Lima',
  });

  async function prescribe(residentId: string, authorization = asCaregiver()) {
    const response = await http()
      .post(MEDICATIONS)
      .set('Authorization', authorization)
      .send(losartana(residentId))
      .expect(201);
    return response.body as { id: string };
  }

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
    beneditoFamily = await testApp.createGuardian({
      contactedClinicIds: [clinicId],
    });
    mariaId = await testApp.createResident({
      name: 'Maria Aparecida',
      clinicId,
      guardianIds: [mariaFamily.id],
    });
    beneditoId = await testApp.createResident({
      name: 'Benedito Nogueira',
      guardianIds: [beneditoFamily.id],
    });
  });

  afterEach(async () => {
    await testApp.close();
  });

  it('lets the clinic staff prescribe and list medications of its residents', async () => {
    const response = await http()
      .post(MEDICATIONS)
      .set('Authorization', asCaregiver())
      .send(losartana(mariaId))
      .expect(201);
    expect(response.body).toMatchObject({
      residentId: mariaId,
      residentName: 'Maria Aparecida',
      form: 'tablet',
      endDate: null,
      active: true,
    });

    const list = await http()
      .get(MEDICATIONS)
      .set('Authorization', asCaregiver())
      .expect(200);
    expect(list.body.data.map(({ id }: { id: string }) => id)).toEqual([
      response.body.id,
    ]);
    await http()
      .get(`${MEDICATIONS}/${response.body.id}`)
      .set('Authorization', asGuardian(mariaFamily))
      .expect(200);

    await http()
      .get(`${MEDICATIONS}/${response.body.id}`)
      .set('Authorization', asOtherClinicNurse())
      .expect(403);
    await http()
      .get(MEDICATIONS)
      .query({ residentId: mariaId })
      .set('Authorization', asOtherClinicNurse())
      .expect(403);
    await http()
      .post(MEDICATIONS)
      .set('Authorization', asOtherClinicNurse())
      .send(losartana(mariaId))
      .expect(403);
    await http()
      .get(`${MEDICATIONS}/${randomUUID()}`)
      .set('Authorization', asCaregiver())
      .expect(404);
  });

  it('lets the guardian keep the medications until the resident is linked', async () => {
    const medication = await prescribe(beneditoId, asGuardian(beneditoFamily));

    const forFamily = await http()
      .get(MEDICATIONS)
      .set('Authorization', asGuardian(beneditoFamily))
      .expect(200);
    expect(forFamily.body.data.map(({ id }: { id: string }) => id)).toEqual([
      medication.id,
    ]);
    const forContactedClinic = await http()
      .get(MEDICATIONS)
      .query({ residentId: beneditoId })
      .set('Authorization', asCaregiver())
      .expect(200);
    expect(forContactedClinic.body.meta.total).toBe(1);

    await http()
      .post(MEDICATIONS)
      .set('Authorization', asCaregiver())
      .send(losartana(beneditoId))
      .expect(403);
    await http()
      .post(MEDICATIONS)
      .set('Authorization', asGuardian(mariaFamily))
      .send(losartana(mariaId))
      .expect(403);
    await http()
      .get(MEDICATIONS)
      .query({ residentId: beneditoId })
      .set('Authorization', asGuardian(mariaFamily))
      .expect(403);
  });

  it('edits and ends a treatment, keeping it as history', async () => {
    const medication = await prescribe(mariaId);
    const path = `${MEDICATIONS}/${medication.id}`;

    const edited = await http()
      .patch(path)
      .set('Authorization', asCaregiver())
      .send({ dosage: '100mg', instructions: null })
      .expect(200);
    expect(edited.body).toMatchObject({
      dosage: '100mg',
      instructions: null,
      name: 'Losartana',
    });
    for (const invalid of [
      { name: null },
      { endDate: '2000-01-01T00:00:00Z' },
      { startDate: '2026-01-01' },
    ]) {
      await http()
        .patch(path)
        .set('Authorization', asCaregiver())
        .send(invalid)
        .expect(400);
    }

    const ended = await http()
      .patch(`${path}/deactivate`)
      .set('Authorization', asCaregiver())
      .expect(200);
    expect(ended.body.active).toBe(false);
    expect(ended.body.endDate).not.toBeNull();
    await http()
      .patch(`${path}/deactivate`)
      .set('Authorization', asCaregiver())
      .expect(409);
    await http()
      .patch(path)
      .set('Authorization', asCaregiver())
      .send({ dosage: '25mg' })
      .expect(409);

    for (const [active, total] of [
      ['true', 0],
      ['false', 1],
    ] as const) {
      const response = await http()
        .get(MEDICATIONS)
        .query({ active })
        .set('Authorization', asCaregiver())
        .expect(200);
      expect(response.body.meta.total).toBe(total);
    }
  });

  it('links a dose activity to the prescription of its single resident', async () => {
    const medication = await prescribe(mariaId);
    const joseId = await testApp.createResident({ clinicId });
    const dose = {
      type: 'medication',
      title: 'Losartana 50mg',
      scheduledTime: '2030-03-10T07:30:00-03:00',
      residentIds: [mariaId],
      medicationId: medication.id,
    };

    const created = await http()
      .post(ACTIVITIES)
      .set('Authorization', asCaregiver())
      .send(dose)
      .expect(201);
    expect(created.body.medicationId).toBe(medication.id);

    for (const invalid of [
      { residentIds: [mariaId, joseId] },
      { residentIds: [joseId] },
      { type: 'meal' },
    ]) {
      await http()
        .post(ACTIVITIES)
        .set('Authorization', asCaregiver())
        .send({ ...dose, ...invalid })
        .expect(400);
    }

    await http()
      .patch(`${MEDICATIONS}/${medication.id}/deactivate`)
      .set('Authorization', asCaregiver())
      .expect(200);
    await http()
      .post(ACTIVITIES)
      .set('Authorization', asCaregiver())
      .send(dose)
      .expect(409);
    await http()
      .patch(`${ACTIVITIES}/${created.body.id}`)
      .set('Authorization', asCaregiver())
      .send({ title: 'Losartana 50mg (manhã)' })
      .expect(200);
  });
});
