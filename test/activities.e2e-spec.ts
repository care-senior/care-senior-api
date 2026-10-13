import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { StaffRole, UserRole } from '../src/common/enums/index.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const ACTIVITIES = '/api/v1/activities';
const FUTURE = '2030-03-10T10:00:00-03:00';

describe('Activities (e2e)', () => {
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
  const statusOf = (
    activity: { participants: { residentId: string; status: string }[] },
    residentId: string,
  ) =>
    activity.participants.find(
      (participant) => participant.residentId === residentId,
    )?.status;

  async function scheduleActivity(
    overrides: { residentIds?: string[]; scheduledTime?: string } = {},
  ) {
    const response = await http()
      .post(ACTIVITIES)
      .set('Authorization', asCaregiver())
      .send({
        type: 'socialGathering',
        title: 'Roda de música',
        scheduledTime: overrides.scheduledTime ?? FUTURE,
        residentIds: overrides.residentIds ?? [mariaId, joseId],
      })
      .expect(201);
    return response.body as {
      id: string;
      participants: { residentId: string; status: string }[];
    };
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

  describe('POST /activities', () => {
    it('schedules an activity shared by residents of the clinic', async () => {
      const response = await http()
        .post(ACTIVITIES)
        .set('Authorization', asCaregiver())
        .send({
          type: 'physicalActivity',
          title: 'Fisioterapia',
          scheduledTime: FUTURE,
          detail: 'Alongamento',
          residentIds: [mariaId, joseId],
        })
        .expect(201);

      expect(response.body).toMatchObject({
        clinicId,
        type: 'physicalActivity',
        title: 'Fisioterapia',
        scheduledTime: '2030-03-10T13:00:00.000Z',
        detail: 'Alongamento',
        participants: [
          {
            residentName: 'José Carlos',
            status: 'pending',
            registeredBy: null,
          },
          { residentName: 'Maria Aparecida', status: 'pending' },
        ],
      });
    });

    it('only takes residents linked to the clinic and staff callers', async () => {
      const unlinkedResidentId = await testApp.createResident();
      const otherClinicResidentId = await testApp.createResident({
        clinicId: otherClinicId,
      });
      const body = {
        type: 'meal',
        title: 'Café',
        scheduledTime: FUTURE,
        residentIds: [mariaId],
      };

      for (const residentIds of [
        [mariaId, unlinkedResidentId],
        [otherClinicResidentId],
      ]) {
        await http()
          .post(ACTIVITIES)
          .set('Authorization', asCaregiver())
          .send({ ...body, residentIds })
          .expect(403);
      }
      await http()
        .post(ACTIVITIES)
        .set('Authorization', asGuardian(mariaFamily))
        .send(body)
        .expect(403);
      for (const invalid of [
        { scheduledTime: '2030-03-10T10:00:00' },
        { residentIds: [] },
        { residentIds: [mariaId, mariaId] },
        { type: 'nap' },
        { photoPath: '/tmp/photo.png' },
      ]) {
        await http()
          .post(ACTIVITIES)
          .set('Authorization', asCaregiver())
          .send({ ...body, ...invalid })
          .expect(400);
      }
    });
  });

  describe('GET /activities', () => {
    it('lists the clinic activities in a time window and of a resident', async () => {
      const early = await scheduleActivity({
        scheduledTime: '2030-03-09T08:00:00-03:00',
        residentIds: [mariaId],
      });
      const late = await scheduleActivity({ residentIds: [joseId] });
      const otherClinicResidentId = await testApp.createResident({
        clinicId: otherClinicId,
      });
      await http()
        .post(ACTIVITIES)
        .set('Authorization', asOtherClinicNurse())
        .send({
          type: 'meal',
          title: 'Café',
          scheduledTime: FUTURE,
          residentIds: [otherClinicResidentId],
        })
        .expect(201);

      const all = await http()
        .get(ACTIVITIES)
        .set('Authorization', asCaregiver())
        .expect(200);
      expect(all.body.data.map(({ id }: { id: string }) => id)).toEqual([
        early.id,
        late.id,
      ]);

      const window = await http()
        .get(ACTIVITIES)
        .query({
          from: '2030-03-10T00:00:00-03:00',
          to: '2030-03-11T00:00:00-03:00',
        })
        .set('Authorization', asCaregiver())
        .expect(200);
      expect(window.body.data.map(({ id }: { id: string }) => id)).toEqual([
        late.id,
      ]);

      const ofMaria = await http()
        .get(ACTIVITIES)
        .query({ residentId: mariaId })
        .set('Authorization', asCaregiver())
        .expect(200);
      expect(ofMaria.body.data.map(({ id }: { id: string }) => id)).toEqual([
        early.id,
      ]);

      await http()
        .get(ACTIVITIES)
        .query({ clinicId: otherClinicId })
        .set('Authorization', asCaregiver())
        .expect(403);
      await http()
        .get(ACTIVITIES)
        .query({ from: FUTURE, to: FUTURE })
        .set('Authorization', asCaregiver())
        .expect(400);
    });

    it('shows a guardian only their residents, never who registered', async () => {
      const shared = await scheduleActivity();
      await scheduleActivity({ residentIds: [joseId] });
      await http()
        .post(`${ACTIVITIES}/${shared.id}/start-all`)
        .set('Authorization', asCaregiver())
        .expect(200);

      const response = await http()
        .get(ACTIVITIES)
        .set('Authorization', asGuardian(mariaFamily))
        .expect(200);

      expect(response.body.meta.total).toBe(1);
      const [activity] = response.body.data;
      expect(activity.participants).toHaveLength(1);
      expect(activity.participants[0]).toMatchObject({
        residentId: mariaId,
        status: 'inProgress',
      });
      expect(activity.participants[0]).not.toHaveProperty('registeredBy');

      await http()
        .get(ACTIVITIES)
        .query({ residentId: joseId })
        .set('Authorization', asGuardian(mariaFamily))
        .expect(403);
    });
  });

  describe('GET /activities/:id', () => {
    it('shows the activity to the clinic and to the families of its participants', async () => {
      const activity = await scheduleActivity({ residentIds: [joseId] });

      await http()
        .get(`${ACTIVITIES}/${activity.id}`)
        .set('Authorization', asGuardian(joseFamily))
        .expect(200);
      await http()
        .get(`${ACTIVITIES}/${activity.id}`)
        .set('Authorization', asGuardian(mariaFamily))
        .expect(403);
      await http()
        .get(`${ACTIVITIES}/${activity.id}`)
        .set('Authorization', asOtherClinicNurse())
        .expect(403);
      await http()
        .get(`${ACTIVITIES}/${randomUUID()}`)
        .set('Authorization', asCaregiver())
        .expect(404);
    });

    it('reports a pending participant as late once the time has passed', async () => {
      const activity = await scheduleActivity({
        scheduledTime: '2020-01-01T10:00:00Z',
        residentIds: [mariaId],
      });

      expect(statusOf(activity, mariaId)).toBe('late');
    });
  });

  describe('PATCH /activities/:id', () => {
    it('edits an activity and its participants until someone starts', async () => {
      const activity = await scheduleActivity();
      const antoniaId = await testApp.createResident({
        name: 'Antônia Ferreira',
        clinicId,
      });

      const response = await http()
        .patch(`${ACTIVITIES}/${activity.id}`)
        .set('Authorization', asCaregiver())
        .send({
          title: 'Roda de música ao vivo',
          detail: null,
          residentIds: [joseId, antoniaId],
        })
        .expect(200);
      expect(response.body).toMatchObject({
        title: 'Roda de música ao vivo',
        type: 'socialGathering',
        detail: null,
      });
      expect(
        response.body.participants.map(
          ({ residentName }: { residentName: string }) => residentName,
        ),
      ).toEqual(['Antônia Ferreira', 'José Carlos']);

      await http()
        .post(`${ACTIVITIES}/${activity.id}/start-all`)
        .set('Authorization', asCaregiver())
        .expect(200);
      await http()
        .patch(`${ACTIVITIES}/${activity.id}`)
        .set('Authorization', asCaregiver())
        .send({ title: 'Too late' })
        .expect(409);
      await http()
        .patch(`${ACTIVITIES}/${activity.id}`)
        .set('Authorization', asOtherClinicNurse())
        .send({ title: 'Not mine' })
        .expect(403);
    });
  });

  describe('participant outcomes', () => {
    it('starts, completes and skips participants once each', async () => {
      const activity = await scheduleActivity();

      const started = await http()
        .post(`${ACTIVITIES}/${activity.id}/start-all`)
        .set('Authorization', asCaregiver())
        .expect(200);
      expect(started.body.participants[0]).toMatchObject({
        status: 'inProgress',
        registeredBy: { id: caregiver.id, name: 'E2E Staff' },
      });

      const completed = await http()
        .post(`${ACTIVITIES}/${activity.id}/participants/${mariaId}/complete`)
        .set('Authorization', asCaregiver())
        .send({ rating: 5, comment: 'Cantou junto' })
        .expect(200);
      expect(
        completed.body.participants.find(
          ({ residentId }: { residentId: string }) => residentId === mariaId,
        ),
      ).toMatchObject({
        status: 'completed',
        rating: 5,
        comment: 'Cantou junto',
      });

      await http()
        .post(`${ACTIVITIES}/${activity.id}/participants/${mariaId}/skip`)
        .set('Authorization', asCaregiver())
        .send({ reason: 'Late answer' })
        .expect(409);
      const skipped = await http()
        .post(`${ACTIVITIES}/${activity.id}/participants/${joseId}/skip`)
        .set('Authorization', asCaregiver())
        .send({ reason: 'Estava dormindo' })
        .expect(200);
      expect(statusOf(skipped.body, joseId)).toBe('skipped');

      const forFamily = await http()
        .get(`${ACTIVITIES}/${activity.id}`)
        .set('Authorization', asGuardian(mariaFamily))
        .expect(200);
      expect(forFamily.body.participants).toEqual([
        expect.objectContaining({ rating: 5, comment: 'Cantou junto' }),
      ]);

      await http()
        .post(`${ACTIVITIES}/${activity.id}/participants/${joseId}/skip`)
        .set('Authorization', asCaregiver())
        .send({})
        .expect(400);
      await http()
        .post(`${ACTIVITIES}/${activity.id}/participants/${joseId}/complete`)
        .set('Authorization', asGuardian(joseFamily))
        .send({ rating: 1 })
        .expect(403);
    });

    it('applies a batch to every resident or to none', async () => {
      const antoniaId = await testApp.createResident({
        name: 'Antônia Ferreira',
        clinicId,
      });
      const activity = await scheduleActivity({
        residentIds: [mariaId, joseId, antoniaId],
      });

      await http()
        .post(`${ACTIVITIES}/${activity.id}/complete-batch`)
        .set('Authorization', asCaregiver())
        .send({ residentIds: [mariaId, joseId], rating: 4 })
        .expect(200);

      const failed = [
        { residentIds: [antoniaId, mariaId], status: 409 },
        { residentIds: [antoniaId, randomUUID()], status: 404 },
      ];
      for (const { residentIds, status } of failed) {
        await http()
          .post(`${ACTIVITIES}/${activity.id}/skip-batch`)
          .set('Authorization', asCaregiver())
          .send({ residentIds, reason: 'Chuva' })
          .expect(status);
      }

      const response = await http()
        .get(`${ACTIVITIES}/${activity.id}`)
        .set('Authorization', asCaregiver())
        .expect(200);
      expect(statusOf(response.body, mariaId)).toBe('completed');
      expect(statusOf(response.body, joseId)).toBe('completed');
      expect(statusOf(response.body, antoniaId)).toBe('pending');
    });
  });
});
