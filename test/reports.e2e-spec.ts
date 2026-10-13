import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { StaffRole, UserRole } from '../src/common/enums/index.js';
import { OccupancySnapshotsService } from '../src/modules/reports/services/occupancy-snapshots.service.js';
import { toBrasiliaDay } from '../src/modules/reports/utils/report-days.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const API = '/api/v1';
const REPORTS = `${API}/reports`;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

describe('Reports (e2e)', () => {
  let testApp: TestApp;
  let clinicId: string;
  let otherClinicId: string;
  let roomId: string;
  let coordinator: { id: string };
  let caregiver: { id: string };
  let family: { id: string };
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
  const asCoordinator = () => asStaff(coordinator, StaffRole.COORDINATOR);
  const asCaregiver = () => asStaff(caregiver, StaffRole.CAREGIVER);
  const asGuardian = (guardian: { id: string }) =>
    `Bearer ${sign({ sub: guardian.id, role: UserRole.GUARDIAN })}`;
  const hoursFromNow = (hours: number) =>
    new Date(Date.now() + hours * HOUR_MS).toISOString();

  async function report(path: string, query: object = {}) {
    const response = await http()
      .get(`${REPORTS}/${path}`)
      .query(query)
      .set('Authorization', asCaregiver())
      .expect(200);
    return response.body;
  }

  async function schedule(body: object) {
    const response = await http()
      .post(`${API}/activities`)
      .set('Authorization', asCaregiver())
      .send({ residentIds: [mariaId, joseId], ...body })
      .expect(201);
    return response.body as { id: string };
  }

  async function register(
    activityId: string,
    residentId: string,
    outcome: 'complete' | 'skip',
  ) {
    await http()
      .post(
        `${API}/activities/${activityId}/participants/${residentId}/${outcome}`,
      )
      .set('Authorization', asCaregiver())
      .send(outcome === 'skip' ? { reason: 'Recusou' } : {})
      .expect(200);
  }

  beforeEach(async () => {
    testApp = await createTestApp();
    clinicId = await testApp.createClinic();
    otherClinicId = await testApp.createClinic({ name: 'Other E2E Clinic' });
    roomId = await testApp.createRoom({ clinicId, capacity: 2 });
    await testApp.createRoom({ clinicId, capacity: 1 });
    coordinator = await testApp.createStaffMember({
      clinicId,
      staffRole: StaffRole.COORDINATOR,
    });
    caregiver = await testApp.createStaffMember({
      clinicId,
      staffRole: StaffRole.CAREGIVER,
    });
    family = await testApp.createGuardian();
    mariaId = await testApp.createResident({
      name: 'Maria Aparecida',
      clinicId,
      roomId,
      guardianIds: [family.id],
    });
    joseId = await testApp.createResident({ name: 'José Carlos', clinicId });
  });

  afterEach(async () => {
    await testApp.close();
  });

  it('sums up the clinic now', async () => {
    const formerStaff = await testApp.createStaffMember({ clinicId });
    await testApp.dataSource.query(
      'UPDATE staff_members SET deactivated_at = now() WHERE id = $1',
      [formerStaff.id],
    );
    const newcomers = await testApp.createGuardian({
      contactedClinicIds: [clinicId],
    });
    await testApp.createResident({ guardianIds: [newcomers.id] });
    await http()
      .post(`${API}/outing-requests`)
      .set('Authorization', asGuardian(family))
      .send({
        residentId: mariaId,
        departureAt: hoursFromNow(24),
        returnAt: hoursFromNow(28),
      })
      .expect(201);

    expect(await report('overview')).toEqual({
      activeResidents: 2,
      activeStaff: 2,
      occupiedBeds: 1,
      capacity: 3,
      occupancyRate: 0.3333,
      pendingLinkRequests: 1,
      pendingOutingRequests: 1,
    });
  });

  it('measures activities, completion and adherence only for what is due', async () => {
    const dose = await schedule({
      type: 'medication',
      title: 'Losartana 50 mg',
      scheduledTime: hoursFromNow(-2),
    });
    await register(dose.id, mariaId, 'complete');
    await schedule({
      type: 'medication',
      title: 'Sinvastatina 20 mg',
      scheduledTime: hoursFromNow(2),
    });
    const music = await schedule({
      type: 'socialGathering',
      title: 'Roda de música',
      scheduledTime: hoursFromNow(-1),
    });
    await register(music.id, joseId, 'skip');

    const byType = await report('activities-by-type');
    expect(byType.types).toHaveLength(8);
    expect(byType.types).toEqual(
      expect.arrayContaining([
        { type: 'medication', count: 1 },
        { type: 'socialGathering', count: 1 },
        { type: 'meal', count: 0 },
      ]),
    );
    const withFuture = await report('activities-by-type', {
      to: hoursFromNow(3),
    });
    expect(withFuture.types).toEqual(
      expect.arrayContaining([{ type: 'medication', count: 2 }]),
    );

    expect(await report('activity-completion')).toMatchObject({
      total: 4,
      completed: 1,
      skipped: 1,
      late: 2,
      inProgress: 0,
      completedRate: 0.25,
      lateRate: 0.5,
    });

    const adherence = await report('medication-adherence', {
      to: hoursFromNow(3),
    });
    expect(adherence.total).toEqual({ due: 2, taken: 1, rate: 0.5 });
    expect(adherence.days).toHaveLength(31);
    expect(adherence.days.at(0)).toEqual({
      date: toBrasiliaDay(new Date(Date.now() - 30 * DAY_MS + 3 * HOUR_MS)),
      due: 0,
      taken: 0,
      rate: null,
    });
  });

  it('shows the occupancy recorded each day and today live', async () => {
    const twoDaysAgo = toBrasiliaDay(new Date(Date.now() - 2 * DAY_MS));
    await testApp.dataSource.query(
      `INSERT INTO occupancy_snapshots (clinic_id, day, occupied_beds, capacity)
       VALUES ($1, $2, 0, 2)`,
      [clinicId, twoDaysAgo],
    );
    await testApp.app.get(OccupancySnapshotsService).recordToday();
    await testApp.createResident({ clinicId, roomId });

    const { days } = await report('occupancy', { from: hoursFromNow(-72) });
    expect(days).toEqual([
      { date: twoDaysAgo, occupiedBeds: 0, capacity: 2, rate: 0 },
      {
        date: toBrasiliaDay(new Date()),
        occupiedBeds: 2,
        capacity: 3,
        rate: 0.6667,
      },
    ]);
  });

  it('summarizes the feedback of the clinic for coordinators and nurses', async () => {
    for (const [authorization, rating] of [
      [asCaregiver(), 4],
      [asGuardian(family), 5],
      [asGuardian(family), 5],
    ] as const) {
      await http()
        .post(`${API}/feedback`)
        .set('Authorization', authorization)
        .send({ rating, message: 'Bom' })
        .expect(201);
    }

    const response = await http()
      .get(`${REPORTS}/feedback-summary`)
      .set('Authorization', asCoordinator())
      .expect(200);
    expect(response.body).toMatchObject({
      total: 3,
      average: 4.67,
      histogram: [
        { rating: 1, count: 0 },
        { rating: 2, count: 0 },
        { rating: 3, count: 0 },
        { rating: 4, count: 1 },
        { rating: 5, count: 2 },
      ],
    });
    await http()
      .get(`${REPORTS}/feedback-summary`)
      .set('Authorization', asCaregiver())
      .expect(403);
  });

  it('validates the period, the clinic and the caller', async () => {
    for (const query of [
      { from: hoursFromNow(1), to: hoursFromNow(-1) },
      { from: hoursFromNow(-400 * 24) },
      { from: '2026-01-01T00:00:00' },
    ]) {
      await http()
        .get(`${REPORTS}/activity-completion`)
        .query(query)
        .set('Authorization', asCaregiver())
        .expect(400);
    }
    await http()
      .get(`${REPORTS}/overview`)
      .query({ clinicId: otherClinicId })
      .set('Authorization', asCaregiver())
      .expect(403);
    await http()
      .get(`${REPORTS}/overview`)
      .set('Authorization', asGuardian(family))
      .expect(403);
  });
});
