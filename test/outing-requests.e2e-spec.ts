import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { StaffRole, UserRole } from '../src/common/enums/index.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const OUTING_REQUESTS = '/api/v1/outing-requests';

describe('OutingRequests (e2e)', () => {
  let testApp: TestApp;
  let clinicId: string;
  let otherClinicId: string;
  let caregiver: { id: string };
  let coordinator: { id: string };
  let otherClinicCoordinator: { id: string };
  let fernanda: { id: string };
  let paulo: { id: string };
  let stranger: { id: string };
  let mariaId: string;
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
  const asCoordinator = () => asStaff(coordinator, StaffRole.COORDINATOR);
  const asOtherClinicCoordinator = () =>
    asStaff(otherClinicCoordinator, StaffRole.COORDINATOR, otherClinicId);
  const asGuardian = (guardian: { id: string }) =>
    `Bearer ${sign({ sub: guardian.id, role: UserRole.GUARDIAN })}`;
  const weekend = {
    departureAt: '2030-05-10T09:00:00-03:00',
    returnAt: '2030-05-12T18:00:00-03:00',
    notes: 'Fim de semana na casa da filha; levar a Losartana',
  };

  async function requestOuting(
    guardian = fernanda,
    residentId = mariaId,
  ): Promise<{ id: string }> {
    const response = await http()
      .post(OUTING_REQUESTS)
      .set('Authorization', asGuardian(guardian))
      .send({ residentId, ...weekend })
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
    coordinator = await testApp.createStaffMember({
      clinicId,
      staffRole: StaffRole.COORDINATOR,
    });
    otherClinicCoordinator = await testApp.createStaffMember({
      clinicId: otherClinicId,
      staffRole: StaffRole.COORDINATOR,
    });
    fernanda = await testApp.createGuardian();
    paulo = await testApp.createGuardian();
    stranger = await testApp.createGuardian();
    mariaId = await testApp.createResident({
      name: 'Maria Aparecida',
      clinicId,
      guardianIds: [fernanda.id, paulo.id],
    });
  });

  afterEach(async () => {
    await testApp.close();
  });

  describe('POST /outing-requests', () => {
    it('lets a guardian ask for an outing of a linked resident', async () => {
      const response = await http()
        .post(OUTING_REQUESTS)
        .set('Authorization', asGuardian(fernanda))
        .send({ residentId: mariaId, ...weekend })
        .expect(201);

      expect(response.body).toMatchObject({
        residentId: mariaId,
        residentName: 'Maria Aparecida',
        guardianId: fernanda.id,
        guardianName: 'E2E Guardian',
        departureAt: '2030-05-10T12:00:00.000Z',
        status: 'pending',
        respondedAt: null,
        rejectionReason: null,
      });
    });

    it('refuses other families, staff, unlinked residents and invalid periods', async () => {
      const unlinkedResidentId = await testApp.createResident({
        guardianIds: [stranger.id],
      });
      const send = (authorization: string, body: object) =>
        http()
          .post(OUTING_REQUESTS)
          .set('Authorization', authorization)
          .send({ residentId: mariaId, ...weekend, ...body });

      await send(asGuardian(stranger), {}).expect(403);
      await send(asCoordinator(), {}).expect(403);
      await send(asGuardian(stranger), {
        residentId: unlinkedResidentId,
      }).expect(409);
      await send(asGuardian(fernanda), { residentId: randomUUID() }).expect(
        404,
      );
      for (const invalid of [
        { returnAt: weekend.departureAt },
        {
          departureAt: '2020-01-01T09:00:00Z',
          returnAt: '2020-01-02T09:00:00Z',
        },
        { departureAt: '2030-05-10T09:00:00' },
      ]) {
        await send(asGuardian(fernanda), invalid).expect(400);
      }
    });
  });

  describe('GET /outing-requests', () => {
    it('shows the family every request of their residents and the clinic its queue', async () => {
      const fromFernanda = await requestOuting(fernanda);
      const fromPaulo = await requestOuting(paulo);
      const strangerResidentId = await testApp.createResident({
        clinicId,
        guardianIds: [stranger.id],
      });
      await requestOuting(stranger, strangerResidentId);

      const forPaulo = await http()
        .get(OUTING_REQUESTS)
        .set('Authorization', asGuardian(paulo))
        .expect(200);
      expect(
        forPaulo.body.data.map(({ id }: { id: string }) => id).sort(),
      ).toEqual([fromFernanda.id, fromPaulo.id].sort());

      const queue = await http()
        .get(OUTING_REQUESTS)
        .query({ status: 'pending', search: 'maria' })
        .set('Authorization', asCaregiver())
        .expect(200);
      expect(queue.body.meta.total).toBe(2);

      const otherClinic = await http()
        .get(OUTING_REQUESTS)
        .set('Authorization', asOtherClinicCoordinator())
        .expect(200);
      expect(otherClinic.body.meta.total).toBe(0);

      await http()
        .get(OUTING_REQUESTS)
        .query({ residentId: strangerResidentId })
        .set('Authorization', asGuardian(paulo))
        .expect(403);
      await http()
        .get(`${OUTING_REQUESTS}/${fromPaulo.id}`)
        .set('Authorization', asGuardian(stranger))
        .expect(403);
      await http()
        .get(`${OUTING_REQUESTS}/${fromPaulo.id}`)
        .set('Authorization', asOtherClinicCoordinator())
        .expect(403);
    });
  });

  describe('approve and reject', () => {
    it('lets coordinators and nurses of the clinic answer once', async () => {
      const outing = await requestOuting();

      await http()
        .post(`${OUTING_REQUESTS}/${outing.id}/approve`)
        .set('Authorization', asCaregiver())
        .expect(403);
      await http()
        .post(`${OUTING_REQUESTS}/${outing.id}/approve`)
        .set('Authorization', asOtherClinicCoordinator())
        .expect(403);

      const approved = await http()
        .post(`${OUTING_REQUESTS}/${outing.id}/approve`)
        .set('Authorization', asCoordinator())
        .expect(200);
      expect(approved.body.status).toBe('approved');
      expect(approved.body.respondedAt).not.toBeNull();

      await http()
        .post(`${OUTING_REQUESTS}/${outing.id}/reject`)
        .set('Authorization', asCoordinator())
        .send({ reason: 'Changed my mind' })
        .expect(409);
    });

    it('shows the rejection reason to the family', async () => {
      const outing = await requestOuting();

      await http()
        .post(`${OUTING_REQUESTS}/${outing.id}/reject`)
        .set('Authorization', asCoordinator())
        .send({})
        .expect(400);
      await http()
        .post(`${OUTING_REQUESTS}/${outing.id}/reject`)
        .set('Authorization', asCoordinator())
        .send({ reason: 'Consulta médica marcada no sábado' })
        .expect(200);

      const forFamily = await http()
        .get(`${OUTING_REQUESTS}/${outing.id}`)
        .set('Authorization', asGuardian(paulo))
        .expect(200);
      expect(forFamily.body).toMatchObject({
        status: 'rejected',
        rejectionReason: 'Consulta médica marcada no sábado',
      });
    });
  });

  describe('DELETE /outing-requests/:id', () => {
    it('lets only the guardian who asked cancel a pending request', async () => {
      const pending = await requestOuting(fernanda);
      const answered = await requestOuting(fernanda);
      await http()
        .post(`${OUTING_REQUESTS}/${answered.id}/approve`)
        .set('Authorization', asCoordinator())
        .expect(200);

      await http()
        .delete(`${OUTING_REQUESTS}/${pending.id}`)
        .set('Authorization', asGuardian(paulo))
        .expect(403);
      await http()
        .delete(`${OUTING_REQUESTS}/${answered.id}`)
        .set('Authorization', asGuardian(fernanda))
        .expect(409);
      await http()
        .delete(`${OUTING_REQUESTS}/${pending.id}`)
        .set('Authorization', asGuardian(fernanda))
        .expect(204);
      await http()
        .get(`${OUTING_REQUESTS}/${pending.id}`)
        .set('Authorization', asGuardian(fernanda))
        .expect(404);
    });
  });
});
