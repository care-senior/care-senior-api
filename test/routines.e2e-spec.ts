import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { StaffRole, UserRole } from '../src/common/enums/index.js';
import { RoutineActivitiesService } from '../src/modules/routines/services/routine-activities.service.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const API = '/api/v1';
const ROUTINES = `${API}/routines`;
const DAY_MS = 24 * 60 * 60 * 1000;
const EVERY_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

interface GeneratedActivity {
  id: string;
  title: string;
  scheduledTime: string;
  detail: string | null;
  routineId: string | null;
  participants: { residentId: string; status: string }[];
}

describe('Routines (e2e)', () => {
  let testApp: TestApp;
  let clinicId: string;
  let otherClinicId: string;
  let roomId: string;
  let caregiver: { id: string };
  let otherClinicNurse: { id: string };
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
  const asCaregiver = () => asStaff(caregiver, StaffRole.CAREGIVER);
  const asOtherClinicNurse = () =>
    asStaff(otherClinicNurse, StaffRole.NURSE, otherClinicId);
  const asGuardian = () =>
    `Bearer ${sign({ sub: family.id, role: UserRole.GUARDIAN })}`;

  async function createRoutine(body: object = {}) {
    const response = await http()
      .post(ROUTINES)
      .set('Authorization', asCaregiver())
      .send({
        title: 'Aferição de pressão',
        activityType: 'vitalSigns',
        time: '07:00',
        weekdays: EVERY_DAY,
        scope: 'allResidents',
        instructions: 'Anotar no prontuário',
        ...body,
      })
      .expect(201);
    return response.body as { id: string };
  }

  async function activitiesOf(routineId: string) {
    const response = await http()
      .get(`${API}/activities`)
      .query({
        from: new Date(Date.now() - DAY_MS).toISOString(),
        to: new Date(Date.now() + 8 * DAY_MS).toISOString(),
        limit: 100,
      })
      .set('Authorization', asCaregiver())
      .expect(200);
    return (response.body.data as GeneratedActivity[]).filter(
      (activity) => activity.routineId === routineId,
    );
  }

  const residentsOf = (activity: GeneratedActivity) =>
    activity.participants.map(({ residentId }) => residentId).sort();

  beforeEach(async () => {
    testApp = await createTestApp();
    clinicId = await testApp.createClinic();
    otherClinicId = await testApp.createClinic({ name: 'Other E2E Clinic' });
    roomId = await testApp.createRoom({ clinicId, capacity: 2 });
    caregiver = await testApp.createStaffMember({
      clinicId,
      staffRole: StaffRole.CAREGIVER,
    });
    otherClinicNurse = await testApp.createStaffMember({
      clinicId: otherClinicId,
      staffRole: StaffRole.NURSE,
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

  describe('POST /routines', () => {
    it('creates the routine and its activities for the next 7 days', async () => {
      const response = await http()
        .post(ROUTINES)
        .set('Authorization', asCaregiver())
        .send({
          title: 'Fisioterapia',
          activityType: 'physicalActivity',
          time: '10:00',
          weekdays: ['wed', 'mon'],
          scope: 'specificResidents',
          residentIds: [mariaId],
        })
        .expect(201);
      expect(response.body).toEqual({
        id: expect.any(String),
        clinicId,
        title: 'Fisioterapia',
        activityType: 'physicalActivity',
        time: '10:00',
        weekdays: ['mon', 'wed'],
        scope: 'specificResidents',
        residents: [{ id: mariaId, name: 'Maria Aparecida' }],
        rooms: [],
        instructions: null,
        active: true,
      });

      const daily = await createRoutine();
      const activities = await activitiesOf(daily.id);
      expect(activities).toHaveLength(7);
      for (const activity of activities) {
        expect(new Date(activity.scheduledTime).getTime()).toBeGreaterThan(
          Date.now(),
        );
        expect(activity).toMatchObject({
          title: 'Aferição de pressão',
          detail: 'Anotar no prontuário',
        });
        expect(residentsOf(activity)).toEqual([mariaId, joseId].sort());
      }
      expect(
        activities.map(({ scheduledTime }) => scheduledTime.slice(11, 16)),
      ).toEqual(Array(7).fill('10:00'));
    });

    it('validates the scope, the clinic and the caller', async () => {
      const otherClinicResident = await testApp.createResident({
        clinicId: otherClinicId,
      });
      const base = {
        title: 'Banho assistido',
        activityType: 'hygiene',
        time: '14:00',
        weekdays: ['mon'],
      };
      for (const invalid of [
        { scope: 'specificResidents' },
        { scope: 'specificRoom', residentIds: [mariaId] },
        { scope: 'allResidents', roomIds: [roomId] },
        { scope: 'allResidents', time: '24:00' },
        { scope: 'allResidents', time: '7:00' },
        { scope: 'allResidents', weekdays: [] },
        { scope: 'allResidents', weekdays: ['mon', 'mon'] },
      ]) {
        await http()
          .post(ROUTINES)
          .set('Authorization', asCaregiver())
          .send({ ...base, ...invalid })
          .expect(400);
      }
      await http()
        .post(ROUTINES)
        .set('Authorization', asCaregiver())
        .send({
          ...base,
          scope: 'specificResidents',
          residentIds: [otherClinicResident],
        })
        .expect(403);
      await http()
        .post(ROUTINES)
        .set('Authorization', asGuardian())
        .send({ ...base, scope: 'allResidents' })
        .expect(403);
    });
  });

  describe('GET /routines', () => {
    it('lists the clinic routines by time, only for its staff', async () => {
      const evening = await createRoutine({ title: 'Jantar', time: '18:30' });
      const morning = await createRoutine({ title: 'Café', time: '08:00' });
      await http()
        .patch(`${ROUTINES}/${evening.id}/toggle`)
        .set('Authorization', asCaregiver())
        .expect(200);

      const all = await http()
        .get(ROUTINES)
        .set('Authorization', asCaregiver())
        .expect(200);
      expect(all.body.data.map(({ id }: { id: string }) => id)).toEqual([
        morning.id,
        evening.id,
      ]);
      const paused = await http()
        .get(ROUTINES)
        .query({ active: false })
        .set('Authorization', asCaregiver())
        .expect(200);
      expect(paused.body.data).toEqual([
        expect.objectContaining({ id: evening.id, active: false }),
      ]);

      const otherClinic = await http()
        .get(ROUTINES)
        .set('Authorization', asOtherClinicNurse())
        .expect(200);
      expect(otherClinic.body.meta.total).toBe(0);
      await http()
        .get(`${ROUTINES}/${morning.id}`)
        .set('Authorization', asOtherClinicNurse())
        .expect(403);
      await http().get(ROUTINES).set('Authorization', asGuardian()).expect(403);
    });
  });

  describe('changing a routine', () => {
    it('rebuilds the upcoming activities, keeping the started and the hand-edited ones', async () => {
      const routine = await createRoutine();
      const [started, edited] = await activitiesOf(routine.id);
      await http()
        .post(`${API}/activities/${started!.id}/start-all`)
        .set('Authorization', asCaregiver())
        .expect(200);
      await http()
        .patch(`${API}/activities/${edited!.id}`)
        .set('Authorization', asCaregiver())
        .send({ title: 'Aferição com o médico' })
        .expect(200);

      const updated = await http()
        .patch(`${ROUTINES}/${routine.id}`)
        .set('Authorization', asCaregiver())
        .send({ time: '19:45', instructions: null })
        .expect(200);
      expect(updated.body).toMatchObject({ time: '19:45', instructions: null });

      const activities = await activitiesOf(routine.id);
      const kept = activities.filter(({ id }) =>
        [started!.id, edited!.id].includes(id),
      );
      expect(kept.map(({ title }) => title).sort()).toEqual([
        'Aferição com o médico',
        'Aferição de pressão',
      ]);
      const rebuilt = activities.filter((activity) => !kept.includes(activity));
      expect(rebuilt).toHaveLength(7);
      for (const activity of rebuilt) {
        expect(activity.scheduledTime.slice(11, 16)).toBe('22:45');
        expect(activity.detail).toBeNull();
      }
    });

    it('moves a routine to rooms and follows who lives there', async () => {
      const routine = await createRoutine();
      await http()
        .patch(`${ROUTINES}/${routine.id}`)
        .set('Authorization', asCaregiver())
        .send({ scope: 'specificRoom' })
        .expect(400);
      const updated = await http()
        .patch(`${ROUTINES}/${routine.id}`)
        .set('Authorization', asCaregiver())
        .send({ scope: 'specificRoom', roomIds: [roomId] })
        .expect(200);
      expect(updated.body.rooms).toEqual([
        { id: roomId, number: expect.any(String) },
      ]);
      for (const activity of await activitiesOf(routine.id)) {
        expect(residentsOf(activity)).toEqual([mariaId]);
      }

      const newcomerId = await testApp.createResident({ clinicId, roomId });
      await testApp.app.get(RoutineActivitiesService).generateAll();
      const activities = await activitiesOf(routine.id);
      expect(activities).toHaveLength(7);
      for (const activity of activities) {
        expect(residentsOf(activity)).toEqual([mariaId, newcomerId].sort());
      }
    });

    it('pauses, resumes and removes, keeping the history', async () => {
      const routine = await createRoutine();
      const [started] = await activitiesOf(routine.id);
      await http()
        .post(`${API}/activities/${started!.id}/start-all`)
        .set('Authorization', asCaregiver())
        .expect(200);

      const paused = await http()
        .patch(`${ROUTINES}/${routine.id}/toggle`)
        .set('Authorization', asCaregiver())
        .expect(200);
      expect(paused.body.active).toBe(false);
      expect((await activitiesOf(routine.id)).map(({ id }) => id)).toEqual([
        started!.id,
      ]);
      await testApp.app.get(RoutineActivitiesService).generateAll();
      expect(await activitiesOf(routine.id)).toHaveLength(1);

      await http()
        .patch(`${ROUTINES}/${routine.id}/toggle`)
        .set('Authorization', asCaregiver())
        .expect(200);
      expect(await activitiesOf(routine.id)).toHaveLength(7);

      await http()
        .delete(`${ROUTINES}/${routine.id}`)
        .set('Authorization', asOtherClinicNurse())
        .expect(403);
      await http()
        .delete(`${ROUTINES}/${routine.id}`)
        .set('Authorization', asCaregiver())
        .expect(204);
      await http()
        .get(`${ROUTINES}/${routine.id}`)
        .set('Authorization', asCaregiver())
        .expect(404);
      const history = await http()
        .get(`${API}/activities/${started!.id}`)
        .set('Authorization', asCaregiver())
        .expect(200);
      expect(history.body.routineId).toBeNull();
    });
  });

  describe('the hourly job', () => {
    it('fills the window without duplicating and drops who left the clinic', async () => {
      const routine = await createRoutine();
      const jobs = testApp.app.get(RoutineActivitiesService);
      await jobs.generateAll();
      await jobs.generateAll();
      expect(await activitiesOf(routine.id)).toHaveLength(7);

      await testApp.dataSource.query(
        'UPDATE residents SET clinic_id = NULL, room_id = NULL WHERE id = $1',
        [joseId],
      );
      const tomorrow = new Date(Date.now() + DAY_MS);
      await jobs.generateAll(tomorrow);
      await jobs.generateAll();
      const activities = await activitiesOf(routine.id);
      expect(activities).toHaveLength(8);
      for (const activity of activities.slice(1)) {
        expect(residentsOf(activity)).toEqual([mariaId]);
      }
    });
  });
});
