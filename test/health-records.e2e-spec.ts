import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { StaffRole, UserRole } from '../src/common/enums/index.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const HEALTH_RECORDS = '/api/v1/health-records';

describe('HealthRecords (e2e)', () => {
  let testApp: TestApp;
  let clinicId: string;
  let otherClinicId: string;
  let caregiver: { id: string };
  let otherClinicNurse: { id: string };
  let mariaFamily: { id: string };
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

  async function record(body: object) {
    const response = await http()
      .post(HEALTH_RECORDS)
      .set('Authorization', asCaregiver())
      .send(body)
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
    mariaId = await testApp.createResident({
      name: 'Maria Aparecida',
      clinicId,
      guardianIds: [mariaFamily.id],
    });
    joseId = await testApp.createResident({ name: 'José Carlos', clinicId });
  });

  afterEach(async () => {
    await testApp.close();
  });

  it('lets the clinic staff record readings of its residents', async () => {
    const response = await http()
      .post(HEALTH_RECORDS)
      .set('Authorization', asCaregiver())
      .send({
        residentId: mariaId,
        type: 'bloodPressure',
        value: '130/85 mmHg',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      residentId: mariaId,
      residentName: 'Maria Aparecida',
      type: 'bloodPressure',
      value: '130/85 mmHg',
      recordedBy: { id: caregiver.id, name: 'E2E Staff' },
    });
    expect(
      Date.now() - new Date(response.body.recordedAt).getTime(),
    ).toBeLessThan(10_000);
  });

  it('refuses other clinics, guardians, unknown types and future readings', async () => {
    const unlinkedResidentId = await testApp.createResident();
    const reading = { residentId: mariaId, type: 'glucose', value: '98 mg/dL' };

    await http()
      .post(HEALTH_RECORDS)
      .set('Authorization', asOtherClinicNurse())
      .send(reading)
      .expect(403);
    await http()
      .post(HEALTH_RECORDS)
      .set('Authorization', asGuardian(mariaFamily))
      .send(reading)
      .expect(403);
    await http()
      .post(HEALTH_RECORDS)
      .set('Authorization', asCaregiver())
      .send({ ...reading, residentId: unlinkedResidentId })
      .expect(403);
    for (const invalid of [
      { type: 'Glicose' },
      { value: '' },
      { recordedAt: '2099-01-01T08:00:00Z' },
      { recordedAt: '2026-01-01T08:00:00' },
    ]) {
      await http()
        .post(HEALTH_RECORDS)
        .set('Authorization', asCaregiver())
        .send({ ...reading, ...invalid })
        .expect(400);
    }
  });

  it('lists the newest readings first, filtered by resident, type and period', async () => {
    const older = await record({
      residentId: mariaId,
      type: 'glucose',
      value: '110 mg/dL',
      recordedAt: '2026-01-10T07:00:00-03:00',
    });
    const newer = await record({
      residentId: mariaId,
      type: 'glucose',
      value: '98 mg/dL',
      recordedAt: '2026-01-11T07:00:00-03:00',
    });
    await record({ residentId: mariaId, type: 'weight', value: '61 kg' });
    await record({ residentId: joseId, type: 'glucose', value: '120 mg/dL' });

    const glucoseOfMaria = await http()
      .get(HEALTH_RECORDS)
      .query({ residentId: mariaId, type: 'glucose' })
      .set('Authorization', asCaregiver())
      .expect(200);
    expect(
      glucoseOfMaria.body.data.map(({ id }: { id: string }) => id),
    ).toEqual([newer.id, older.id]);

    const window = await http()
      .get(HEALTH_RECORDS)
      .query({
        from: '2026-01-10T00:00:00-03:00',
        to: '2026-01-11T00:00:00-03:00',
      })
      .set('Authorization', asCaregiver())
      .expect(200);
    expect(window.body.data.map(({ id }: { id: string }) => id)).toEqual([
      older.id,
    ]);

    const clinic = await http()
      .get(HEALTH_RECORDS)
      .set('Authorization', asCaregiver())
      .expect(200);
    expect(clinic.body.meta.total).toBe(4);
    const otherClinic = await http()
      .get(HEALTH_RECORDS)
      .set('Authorization', asOtherClinicNurse())
      .expect(200);
    expect(otherClinic.body.meta.total).toBe(0);
    await http()
      .get(HEALTH_RECORDS)
      .query({ residentId: mariaId })
      .set('Authorization', asOtherClinicNurse())
      .expect(403);
  });

  it('shows the family the readings of their residents, without who recorded them', async () => {
    await record({
      residentId: mariaId,
      type: 'temperature',
      value: '36,5 °C',
    });
    await record({ residentId: joseId, type: 'temperature', value: '37 °C' });

    const response = await http()
      .get(HEALTH_RECORDS)
      .set('Authorization', asGuardian(mariaFamily))
      .expect(200);

    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0]).toMatchObject({
      residentId: mariaId,
      value: '36,5 °C',
    });
    expect(response.body.data[0]).not.toHaveProperty('recordedBy');
    await http()
      .get(HEALTH_RECORDS)
      .query({ residentId: joseId })
      .set('Authorization', asGuardian(mariaFamily))
      .expect(403);
  });
});
