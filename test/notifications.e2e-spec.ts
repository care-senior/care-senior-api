import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { StaffRole, UserRole } from '../src/common/enums/index.js';
import { RemindersService } from '../src/modules/notifications/services/reminders.service.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const API = '/api/v1';
const NOTIFICATIONS = `${API}/notifications`;
const MINUTE_MS = 60 * 1000;

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
}

describe('Notifications (e2e)', () => {
  let testApp: TestApp;
  let clinicId: string;
  let roomId: string;
  let coordinator: { id: string };
  let caregiver: { id: string };
  let mariaFamily: { id: string };
  let mariaOtherFamily: { id: string };
  let joseFamily: { id: string };
  let mariaId: string;
  let joseId: string;
  const http = () => request(testApp.app.getHttpServer());
  const sign = (payload: object) =>
    new JwtService({ secret: process.env.JWT_SECRET }).sign(payload);
  const asStaff = (staff: { id: string }, staffRole: StaffRole) =>
    `Bearer ${sign({ sub: staff.id, role: UserRole.STAFF, staffRole, clinicId })}`;
  const asCoordinator = () => asStaff(coordinator, StaffRole.COORDINATOR);
  const asCaregiver = () => asStaff(caregiver, StaffRole.CAREGIVER);
  const asGuardian = (guardian: { id: string }) =>
    `Bearer ${sign({ sub: guardian.id, role: UserRole.GUARDIAN })}`;

  async function inbox(authorization: string, query: object = {}) {
    const response = await http()
      .get(NOTIFICATIONS)
      .query(query)
      .set('Authorization', authorization)
      .expect(200);
    return response.body as {
      data: Notification[];
      meta: { total: number };
    };
  }

  async function titles(authorization: string) {
    return (await inbox(authorization)).data.map(({ title }) => title);
  }

  async function scheduleActivity(body: object) {
    const response = await http()
      .post(`${API}/activities`)
      .set('Authorization', asCaregiver())
      .send({
        type: 'socialGathering',
        title: 'Roda de música',
        scheduledTime: new Date(Date.now() + 20 * MINUTE_MS).toISOString(),
        residentIds: [mariaId, joseId],
        ...body,
      })
      .expect(201);
    return response.body as { id: string; scheduledTime: string };
  }

  beforeEach(async () => {
    testApp = await createTestApp();
    clinicId = await testApp.createClinic({ name: 'Clínica E2E' });
    roomId = await testApp.createRoom({ clinicId, capacity: 2 });
    coordinator = await testApp.createStaffMember({
      clinicId,
      staffRole: StaffRole.COORDINATOR,
    });
    caregiver = await testApp.createStaffMember({
      clinicId,
      staffRole: StaffRole.CAREGIVER,
    });
    mariaFamily = await testApp.createGuardian();
    mariaOtherFamily = await testApp.createGuardian();
    joseFamily = await testApp.createGuardian();
    mariaId = await testApp.createResident({
      name: 'Maria Aparecida',
      clinicId,
      roomId,
      guardianIds: [mariaFamily.id, mariaOtherFamily.id],
    });
    joseId = await testApp.createResident({
      name: 'José Carlos',
      clinicId,
      roomId,
      guardianIds: [joseFamily.id],
    });
  });

  afterEach(async () => {
    await testApp.close();
  });

  describe('inbox', () => {
    it('lists, filters and marks as read only the notifications of the caller', async () => {
      await http()
        .post(`${API}/messages`)
        .set('Authorization', asCaregiver())
        .send({ residentId: mariaId, text: 'Almoçou bem hoje.' })
        .expect(201);
      await http()
        .post(`${API}/messages`)
        .set('Authorization', asCaregiver())
        .send({ residentId: mariaId, text: 'Dormiu cedo.' })
        .expect(201);

      const unread = await inbox(asGuardian(mariaFamily), { unread: true });
      expect(unread.meta.total).toBe(2);
      const [newest, oldest] = unread.data;
      expect(newest).toMatchObject({
        type: 'general',
        title: 'Novo recado sobre Maria Aparecida',
        message: 'E2E Staff: Dormiu cedo.',
        readAt: null,
      });

      await http()
        .patch(`${NOTIFICATIONS}/${newest!.id}/read`)
        .set('Authorization', asGuardian(joseFamily))
        .expect(404);
      const read = await http()
        .patch(`${NOTIFICATIONS}/${newest!.id}/read`)
        .set('Authorization', asGuardian(mariaFamily))
        .expect(200);
      expect(read.body.readAt).not.toBeNull();
      const readAgain = await http()
        .patch(`${NOTIFICATIONS}/${newest!.id}/read`)
        .set('Authorization', asGuardian(mariaFamily))
        .expect(200);
      expect(readAgain.body.readAt).toBe(read.body.readAt);

      expect(
        (await inbox(asGuardian(mariaFamily), { unread: true })).data,
      ).toEqual([expect.objectContaining({ id: oldest!.id })]);
      expect(
        (await inbox(asGuardian(mariaOtherFamily), { unread: true })).meta
          .total,
      ).toBe(2);

      await http()
        .patch(`${NOTIFICATIONS}/read-all`)
        .set('Authorization', asGuardian(mariaFamily))
        .expect(204);
      expect(
        (await inbox(asGuardian(mariaFamily), { unread: true })).meta.total,
      ).toBe(0);
      expect(
        (await inbox(asGuardian(mariaFamily), { unread: false })).meta.total,
      ).toBe(2);
      await http()
        .get(NOTIFICATIONS)
        .query({ unread: 'yes' })
        .set('Authorization', asGuardian(mariaFamily))
        .expect(400);
    });
  });

  describe('events', () => {
    it('tells the managers about an outing request and the family about the answer', async () => {
      const departureAt = new Date(Date.now() + 24 * 60 * MINUTE_MS);
      const outing = await http()
        .post(`${API}/outing-requests`)
        .set('Authorization', asGuardian(mariaFamily))
        .send({
          residentId: mariaId,
          departureAt: departureAt.toISOString(),
          returnAt: new Date(
            departureAt.getTime() + 4 * 60 * MINUTE_MS,
          ).toISOString(),
        })
        .expect(201);

      expect(await titles(asCoordinator())).toEqual([
        'Nova solicitação de saída',
      ]);
      expect(await titles(asCaregiver())).toEqual([]);

      await http()
        .post(`${API}/outing-requests/${outing.body.id}/reject`)
        .set('Authorization', asCoordinator())
        .send({ reason: 'Consulta médica no horário' })
        .expect(200);

      for (const family of [mariaFamily, mariaOtherFamily]) {
        const { data } = await inbox(asGuardian(family));
        expect(data).toEqual([
          expect.objectContaining({
            title: 'Saída recusada',
            message: expect.stringContaining('Consulta médica no horário'),
          }),
        ]);
      }
      expect(await titles(asGuardian(joseFamily))).toEqual([]);
    });

    it('delivers a family message to the clinic and the other guardians, not to the sender', async () => {
      await http()
        .post(`${API}/messages`)
        .set('Authorization', asGuardian(mariaFamily))
        .send({ residentId: mariaId, text: 'Levo o casaco amanhã.' })
        .expect(201);

      const expected = ['Novo recado sobre Maria Aparecida'];
      expect(await titles(asGuardian(mariaOtherFamily))).toEqual(expected);
      expect(await titles(asCoordinator())).toEqual(expected);
      expect(await titles(asCaregiver())).toEqual(expected);
      expect(await titles(asGuardian(mariaFamily))).toEqual([]);
      expect(await titles(asGuardian(joseFamily))).toEqual([]);
    });

    it('tells the family when the resident is linked and discharged', async () => {
      const family = await testApp.createGuardian({
        contactedClinicIds: [clinicId],
      });
      const residentId = await testApp.createResident({
        name: 'Benedito Nogueira',
        guardianIds: [family.id],
      });
      const otherRoomId = await testApp.createRoom({ clinicId });

      await http()
        .post(`${API}/residents/${residentId}/link`)
        .set('Authorization', asCoordinator())
        .send({ roomId: otherRoomId })
        .expect(200);
      await http()
        .post(`${API}/residents/${residentId}/discharge`)
        .set('Authorization', asCoordinator())
        .expect(200);

      const { data } = await inbox(asGuardian(family));
      expect(data.map(({ title, message }) => ({ title, message }))).toEqual([
        {
          title: 'Alta registrada',
          message: 'A Clínica E2E registrou a alta de Benedito Nogueira.',
        },
        {
          title: 'Vínculo aceito',
          message: expect.stringMatching(
            /^Benedito Nogueira agora está na Clínica E2E, quarto E2E-/,
          ),
        },
      ]);
    });

    it('tells each family only about the outcome of their own resident', async () => {
      const activity = await scheduleActivity({});

      await http()
        .post(
          `${API}/activities/${activity.id}/participants/${mariaId}/complete`,
        )
        .set('Authorization', asCaregiver())
        .send({ rating: 5, comment: 'Cantou junto' })
        .expect(200);
      await http()
        .post(`${API}/activities/${activity.id}/participants/${joseId}/skip`)
        .set('Authorization', asCaregiver())
        .send({ reason: 'Estava dormindo' })
        .expect(200);

      expect((await inbox(asGuardian(mariaFamily))).data).toEqual([
        expect.objectContaining({
          title: 'Atividade concluída: Roda de música',
          message:
            'Maria Aparecida concluiu Roda de música: nota 5/5 — Cantou junto',
        }),
      ]);
      expect((await inbox(asGuardian(joseFamily))).data).toEqual([
        expect.objectContaining({
          title: 'Atividade não realizada: Roda de música',
          message: 'José Carlos não fez Roda de música: Estava dormindo',
        }),
      ]);
      expect(await titles(asCaregiver())).toEqual([]);
    });
  });

  describe('reminders', () => {
    it('reminds the clinic staff once before a dose and once when it is overdue', async () => {
      await scheduleActivity({
        type: 'medication',
        title: 'Losartana 50 mg',
        residentIds: [mariaId],
      });
      const reminders = testApp.app.get(RemindersService);

      await reminders.sendDueReminders(new Date());
      await reminders.sendDueReminders(new Date());
      const upcoming = await inbox(asCaregiver());
      expect(upcoming.data).toEqual([
        expect.objectContaining({
          type: 'medicationUpcoming',
          message: 'Para Maria Aparecida.',
        }),
      ]);
      expect(await titles(asGuardian(mariaFamily))).toEqual([]);

      const anHourLater = new Date(Date.now() + 60 * MINUTE_MS);
      await reminders.sendDueReminders(anHourLater);
      await reminders.sendDueReminders(anHourLater);
      expect(
        (await inbox(asCoordinator())).data.map(({ type }) => type),
      ).toEqual(['medicationOverdue', 'medicationUpcoming']);
    });

    it('stops reminding once the dose is registered', async () => {
      const activity = await scheduleActivity({
        type: 'medication',
        title: 'Losartana 50 mg',
        residentIds: [mariaId],
      });
      await http()
        .post(
          `${API}/activities/${activity.id}/participants/${mariaId}/complete`,
        )
        .set('Authorization', asCaregiver())
        .send({})
        .expect(200);

      const reminders = testApp.app.get(RemindersService);
      await reminders.sendDueReminders(new Date());
      await reminders.sendDueReminders(new Date(Date.now() + 60 * MINUTE_MS));

      expect(await titles(asCaregiver())).toEqual([]);
    });
  });
});
