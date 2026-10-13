import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { StaffRole, UserRole } from '../src/common/enums/index.js';
import {
  createTestApp,
  uniqueEmail,
  type TestApp,
} from './support/test-app.js';

const RESIDENTS = '/api/v1/residents';

describe('Residents (e2e)', () => {
  let testApp: TestApp;
  let clinicId: string;
  let otherClinicId: string;
  let roomId: string;
  let caregiver: { id: string };
  let nurse: { id: string };
  let otherClinicNurse: { id: string };
  let guardian: { id: string };
  let linkedResidentId: string;
  const http = () => request(testApp.app.getHttpServer());
  const sign = (payload: object) =>
    new JwtService({ secret: process.env.JWT_SECRET }).sign(payload);
  const asStaff = (
    staff: { id: string },
    staffRole: StaffRole,
    staffClinicId = clinicId,
  ) =>
    `Bearer ${sign({ sub: staff.id, role: UserRole.STAFF, staffRole, clinicId: staffClinicId })}`;
  const asGuardian = (account: { id: string }) =>
    `Bearer ${sign({ sub: account.id, role: UserRole.GUARDIAN })}`;
  const asCaregiver = () => asStaff(caregiver, StaffRole.CAREGIVER);
  const asNurse = () => asStaff(nurse, StaffRole.NURSE);
  const asOtherClinicNurse = () =>
    asStaff(otherClinicNurse, StaffRole.NURSE, otherClinicId);

  async function createPendingLinkRequest(contactedClinicId = clinicId) {
    const family = await testApp.createGuardian({
      contactedClinicIds: [contactedClinicId],
    });
    const residentId = await testApp.createResident({
      name: 'Benedito Nogueira',
      guardianIds: [family.id],
    });
    return { family, residentId };
  }

  beforeEach(async () => {
    testApp = await createTestApp();
    clinicId = await testApp.createClinic();
    otherClinicId = await testApp.createClinic({ name: 'Other E2E Clinic' });
    roomId = await testApp.createRoom({ clinicId, capacity: 2 });
    caregiver = await testApp.createStaffMember({
      clinicId,
      staffRole: StaffRole.CAREGIVER,
    });
    nurse = await testApp.createStaffMember({
      clinicId,
      staffRole: StaffRole.NURSE,
    });
    otherClinicNurse = await testApp.createStaffMember({
      clinicId: otherClinicId,
      staffRole: StaffRole.NURSE,
    });
    guardian = await testApp.createGuardian();
    linkedResidentId = await testApp.createResident({
      name: 'Maria Aparecida',
      clinicId,
      roomId,
      guardianIds: [guardian.id],
    });
  });

  afterEach(async () => {
    await testApp.close();
  });

  describe('GET /residents', () => {
    it('lists the residents of the staff clinic with their room number', async () => {
      await testApp.createResident({ clinicId: otherClinicId });
      await createPendingLinkRequest();

      const response = await http()
        .get(RESIDENTS)
        .set('Authorization', asCaregiver())
        .expect(200);

      expect(response.body.meta).toMatchObject({ total: 1, page: 1 });
      expect(response.body.data[0]).toMatchObject({
        id: linkedResidentId,
        clinicId,
        roomId,
        roomNumber: expect.stringMatching(/^E2E-/),
      });
    });

    it('filters by guardian and name, and refuses another clinic', async () => {
      await testApp.createResident({ name: 'Joaquim Ribeiro', clinicId });

      const byGuardian = await http()
        .get(`${RESIDENTS}?guardianId=${guardian.id}`)
        .set('Authorization', asCaregiver())
        .expect(200);
      expect(byGuardian.body.data.map(({ id }: { id: string }) => id)).toEqual([
        linkedResidentId,
      ]);

      const byName = await http()
        .get(`${RESIDENTS}?search=joaq`)
        .set('Authorization', asCaregiver())
        .expect(200);
      expect(byName.body.data).toHaveLength(1);
      expect(byName.body.data[0].name).toBe('Joaquim Ribeiro');

      await http()
        .get(`${RESIDENTS}?clinicId=${otherClinicId}`)
        .set('Authorization', asCaregiver())
        .expect(403);
    });

    it('lists only the residents of the guardian, linked or not', async () => {
      const unlinkedResidentId = await testApp.createResident({
        name: 'Ana Souza',
        guardianIds: [guardian.id],
      });
      await testApp.createResident({ clinicId });

      const response = await http()
        .get(RESIDENTS)
        .set('Authorization', asGuardian(guardian))
        .expect(200);

      expect(response.body.data.map(({ id }: { id: string }) => id)).toEqual([
        unlinkedResidentId,
        linkedResidentId,
      ]);
      expect(response.body.data[0]).toMatchObject({
        clinicId: null,
        roomId: null,
        roomNumber: null,
      });

      await http()
        .get(`${RESIDENTS}?guardianId=${randomUUID()}`)
        .set('Authorization', asGuardian(guardian))
        .expect(403);
    });
  });

  describe('GET /residents/:id', () => {
    it('shows the resident to its guardians and to the staff of its clinic only', async () => {
      const stranger = await testApp.createGuardian();

      await http()
        .get(`${RESIDENTS}/${linkedResidentId}`)
        .set('Authorization', asGuardian(guardian))
        .expect(200);
      await http()
        .get(`${RESIDENTS}/${linkedResidentId}`)
        .set('Authorization', asCaregiver())
        .expect(200);
      await http()
        .get(`${RESIDENTS}/${linkedResidentId}`)
        .set('Authorization', asGuardian(stranger))
        .expect(403);
      await http()
        .get(`${RESIDENTS}/${linkedResidentId}`)
        .set('Authorization', asOtherClinicNurse())
        .expect(403);
      await http()
        .get(`${RESIDENTS}/${randomUUID()}`)
        .set('Authorization', asCaregiver())
        .expect(404);
    });

    it('shows an unlinked resident to the clinics their guardian contacted', async () => {
      const { residentId } = await createPendingLinkRequest();

      await http()
        .get(`${RESIDENTS}/${residentId}`)
        .set('Authorization', asCaregiver())
        .expect(200);
      await http()
        .get(`${RESIDENTS}/${residentId}`)
        .set('Authorization', asOtherClinicNurse())
        .expect(403);
    });
  });

  describe('PATCH /residents/:id', () => {
    it('lets the guardian fill in the profile before the link, clearing fields with null', async () => {
      const residentId = await testApp.createResident({
        name: 'Ana Souza',
        guardianIds: [guardian.id],
      });

      await http()
        .patch(`${RESIDENTS}/${residentId}`)
        .set('Authorization', asGuardian(guardian))
        .send({ mood: 'calm', peculiarities: 'Likes the window seat' })
        .expect(200);
      const response = await http()
        .patch(`${RESIDENTS}/${residentId}`)
        .set('Authorization', asGuardian(guardian))
        .send({ peculiarities: null, healthNotes: 'Hypertension' })
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Ana Souza',
        mood: 'calm',
        peculiarities: null,
        healthNotes: 'Hypertension',
      });
    });

    it('hands the profile over to the clinic once the resident is linked', async () => {
      await http()
        .patch(`${RESIDENTS}/${linkedResidentId}`)
        .set('Authorization', asGuardian(guardian))
        .send({ mood: 'calm' })
        .expect(403);

      const response = await http()
        .patch(`${RESIDENTS}/${linkedResidentId}`)
        .set('Authorization', asCaregiver())
        .send({ age: 83, emergencyContactPhone: '(61) 99123-4567' })
        .expect(200);
      expect(response.body).toMatchObject({
        age: 83,
        emergencyContactPhone: '(61) 99123-4567',
      });

      await http()
        .patch(`${RESIDENTS}/${linkedResidentId}`)
        .set('Authorization', asOtherClinicNurse())
        .send({ age: 84 })
        .expect(403);
    });

    it('rejects null on required fields and unknown fields', async () => {
      for (const body of [
        { name: null },
        { age: null },
        { clinicId: clinicId },
      ]) {
        await http()
          .patch(`${RESIDENTS}/${linkedResidentId}`)
          .set('Authorization', asCaregiver())
          .send(body)
          .expect(400);
      }
    });
  });

  describe('POST /residents/:id/link', () => {
    it('places a resident with a pending request in a room and takes it off the queue', async () => {
      const { residentId } = await createPendingLinkRequest();

      const response = await http()
        .post(`${RESIDENTS}/${residentId}/link`)
        .set('Authorization', asNurse())
        .send({ roomId })
        .expect(200);

      expect(response.body).toMatchObject({
        clinicId,
        roomId,
        roomNumber: expect.stringMatching(/^E2E-/),
      });
      const queue = await http()
        .get('/api/v1/guardians/pending-link-requests')
        .set('Authorization', asNurse())
        .expect(200);
      expect(queue.body.meta.total).toBe(0);

      await http()
        .post(`${RESIDENTS}/${residentId}/link`)
        .set('Authorization', asNurse())
        .send({ roomId })
        .expect(409);
    });

    it('requires a manager role, a request for the clinic and a free bed', async () => {
      const { residentId } = await createPendingLinkRequest();
      const { residentId: otherClinicRequest } =
        await createPendingLinkRequest(otherClinicId);
      const fullRoomId = await testApp.createRoom({ clinicId, capacity: 1 });
      await testApp.createResident({ clinicId, roomId: fullRoomId });

      await http()
        .post(`${RESIDENTS}/${residentId}/link`)
        .set('Authorization', asCaregiver())
        .send({ roomId })
        .expect(403);
      await http()
        .post(`${RESIDENTS}/${otherClinicRequest}/link`)
        .set('Authorization', asNurse())
        .send({ roomId })
        .expect(403);
      await http()
        .post(`${RESIDENTS}/${residentId}/link`)
        .set('Authorization', asNurse())
        .send({ roomId: fullRoomId })
        .expect(409);
      await http()
        .post(`${RESIDENTS}/${residentId}/link`)
        .set('Authorization', asNurse())
        .send({ roomId: 'not-a-uuid' })
        .expect(400);
    });
  });

  describe('POST /residents/:id/discharge', () => {
    it('unlinks the resident from the clinic, keeping the guardians', async () => {
      await http()
        .post(`${RESIDENTS}/${linkedResidentId}/discharge`)
        .set('Authorization', asCaregiver())
        .expect(403);
      await http()
        .post(`${RESIDENTS}/${linkedResidentId}/discharge`)
        .set('Authorization', asOtherClinicNurse())
        .expect(403);

      const response = await http()
        .post(`${RESIDENTS}/${linkedResidentId}/discharge`)
        .set('Authorization', asNurse())
        .expect(200);

      expect(response.body).toMatchObject({
        clinicId: null,
        roomId: null,
        roomNumber: null,
      });
      await http()
        .get(`${RESIDENTS}/${linkedResidentId}`)
        .set('Authorization', asGuardian(guardian))
        .expect(200);
    });
  });

  describe('POST /residents/:id/change-room', () => {
    it('moves the resident to a free bed of the same clinic', async () => {
      const newRoomId = await testApp.createRoom({ clinicId, capacity: 1 });
      const otherClinicRoomId = await testApp.createRoom({
        clinicId: otherClinicId,
        capacity: 1,
      });

      const response = await http()
        .post(`${RESIDENTS}/${linkedResidentId}/change-room`)
        .set('Authorization', asCaregiver())
        .send({ roomId: newRoomId })
        .expect(200);
      expect(response.body.roomId).toBe(newRoomId);

      await http()
        .post(`${RESIDENTS}/${linkedResidentId}/change-room`)
        .set('Authorization', asCaregiver())
        .send({ roomId: newRoomId })
        .expect(200);
      await testApp.createResident({ clinicId, roomId });
      await testApp.createResident({ clinicId, roomId });
      await http()
        .post(`${RESIDENTS}/${linkedResidentId}/change-room`)
        .set('Authorization', asCaregiver())
        .send({ roomId })
        .expect(409);
      await http()
        .post(`${RESIDENTS}/${linkedResidentId}/change-room`)
        .set('Authorization', asCaregiver())
        .send({ roomId: otherClinicRoomId })
        .expect(403);
    });
  });

  describe('/residents/:id/guardians', () => {
    it('lists the guardians of the resident to the clinic and to the family', async () => {
      const response = await http()
        .get(`${RESIDENTS}/${linkedResidentId}/guardians`)
        .set('Authorization', asGuardian(guardian))
        .expect(200);

      expect(response.body.meta.total).toBe(1);
      expect(response.body.data[0]).toMatchObject({
        id: guardian.id,
        maskedCpf: '•••.•••.•••-25',
      });
      await http()
        .get(`${RESIDENTS}/${linkedResidentId}/guardians`)
        .set('Authorization', asOtherClinicNurse())
        .expect(403);
    });

    it('registers one more guardian and sends the invite', async () => {
      const email = uniqueEmail('second-guardian');
      const body = { name: 'Paulo Souza', email, cpf: '529.982.247-25' };

      const response = await http()
        .post(`${RESIDENTS}/${linkedResidentId}/guardians`)
        .set('Authorization', asCaregiver())
        .send(body)
        .expect(201);

      expect(response.body).toMatchObject({ name: 'Paulo Souza', email });
      expect(testApp.mail.sendInvite).toHaveBeenCalledWith(
        expect.objectContaining({ to: email, role: UserRole.GUARDIAN }),
      );
      const guardians = await http()
        .get(`${RESIDENTS}/${linkedResidentId}/guardians`)
        .set('Authorization', asCaregiver())
        .expect(200);
      expect(guardians.body.meta.total).toBe(2);

      await http()
        .post(`${RESIDENTS}/${linkedResidentId}/guardians`)
        .set('Authorization', asCaregiver())
        .send(body)
        .expect(409);
      await http()
        .post(`${RESIDENTS}/${linkedResidentId}/guardians`)
        .set('Authorization', asGuardian(guardian))
        .send({ ...body, email: uniqueEmail('family') })
        .expect(403);
      await http()
        .post(`${RESIDENTS}/${linkedResidentId}/guardians`)
        .set('Authorization', asOtherClinicNurse())
        .send({ ...body, email: uniqueEmail('family') })
        .expect(403);
    });
  });
});
