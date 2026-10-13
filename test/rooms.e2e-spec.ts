import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { StaffRole, UserRole } from '../src/common/enums/index.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const ROOMS = '/api/v1/rooms';

describe('Rooms (e2e)', () => {
  let testApp: TestApp;
  let clinicId: string;
  let otherClinicId: string;
  let caregiver: { id: string };
  let nurse: { id: string };
  let otherClinicNurse: { id: string };
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
  const asNurse = () => asStaff(nurse, StaffRole.NURSE);
  const asOtherClinicNurse = () =>
    asStaff(otherClinicNurse, StaffRole.NURSE, otherClinicId);
  const ids = (rooms: { id: string }[]) => rooms.map(({ id }) => id).sort();

  async function createRoomWith(capacity: number, occupantNames: string[]) {
    const roomId = await testApp.createRoom({ clinicId, capacity });
    for (const name of occupantNames) {
      await testApp.createResident({ name, clinicId, roomId });
    }
    return roomId;
  }

  beforeEach(async () => {
    testApp = await createTestApp();
    clinicId = await testApp.createClinic();
    otherClinicId = await testApp.createClinic({ name: 'Other E2E Clinic' });
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
  });

  afterEach(async () => {
    await testApp.close();
  });

  describe('GET /rooms', () => {
    it('lists the rooms of the clinic with occupants and free beds', async () => {
      const fullRoomId = await createRoomWith(1, ['Maria Aparecida']);
      const doubleRoomId = await createRoomWith(2, ['José Carlos']);
      const emptyRoomId = await createRoomWith(1, []);
      await testApp.createRoom({ clinicId: otherClinicId });

      const response = await http()
        .get(ROOMS)
        .set('Authorization', asCaregiver())
        .expect(200);

      expect(response.body.meta.total).toBe(3);
      expect(
        response.body.data.find(
          ({ id }: { id: string }) => id === doubleRoomId,
        ),
      ).toMatchObject({
        clinicId,
        floor: 'Térreo',
        wing: null,
        capacity: 2,
        occupants: [{ name: 'José Carlos', age: 80 }],
        freeBeds: 1,
        status: 'vacant',
      });

      const vacant = await http()
        .get(`${ROOMS}?status=vacant`)
        .set('Authorization', asCaregiver())
        .expect(200);
      expect(ids(vacant.body.data)).toEqual([doubleRoomId, emptyRoomId].sort());
      const occupied = await http()
        .get(`${ROOMS}?status=occupied`)
        .set('Authorization', asCaregiver())
        .expect(200);
      expect(ids(occupied.body.data)).toEqual([fullRoomId]);
    });

    it('refuses another clinic and guardians', async () => {
      const guardian = await testApp.createGuardian();

      await http()
        .get(`${ROOMS}?clinicId=${otherClinicId}`)
        .set('Authorization', asCaregiver())
        .expect(403);
      await http()
        .get(ROOMS)
        .set(
          'Authorization',
          `Bearer ${sign({ sub: guardian.id, role: UserRole.GUARDIAN })}`,
        )
        .expect(403);
      await http()
        .get(`${ROOMS}?status=empty`)
        .set('Authorization', asCaregiver())
        .expect(400);
    });
  });

  describe('GET /rooms/:id', () => {
    it('shows a room to the staff of its clinic only', async () => {
      const roomId = await createRoomWith(1, ['Maria Aparecida']);

      const response = await http()
        .get(`${ROOMS}/${roomId}`)
        .set('Authorization', asCaregiver())
        .expect(200);
      expect(response.body).toMatchObject({ status: 'occupied', freeBeds: 0 });

      await http()
        .get(`${ROOMS}/${roomId}`)
        .set('Authorization', asOtherClinicNurse())
        .expect(403);
      await http()
        .get(`${ROOMS}/${randomUUID()}`)
        .set('Authorization', asCaregiver())
        .expect(404);
    });
  });

  describe('POST /rooms', () => {
    it('lets coordinators and nurses register rooms with a unique number', async () => {
      const room = { number: '14B', floor: 'Térreo', wing: 'A', capacity: 2 };

      const response = await http()
        .post(ROOMS)
        .set('Authorization', asNurse())
        .send(room)
        .expect(201);
      expect(response.body).toMatchObject({
        ...room,
        clinicId,
        occupants: [],
        freeBeds: 2,
        status: 'vacant',
      });

      await http()
        .post(ROOMS)
        .set('Authorization', asNurse())
        .send(room)
        .expect(409);
      await http()
        .post(ROOMS)
        .set('Authorization', asOtherClinicNurse())
        .send(room)
        .expect(201);
      await http()
        .post(ROOMS)
        .set('Authorization', asCaregiver())
        .send({ ...room, number: '15' })
        .expect(403);
      await http()
        .post(ROOMS)
        .set('Authorization', asNurse())
        .send({ ...room, number: '16', capacity: 0 })
        .expect(400);
    });
  });

  describe('PATCH /rooms/:id', () => {
    it('updates a room, keeping the fields not sent', async () => {
      const { body: room } = await http()
        .post(ROOMS)
        .set('Authorization', asNurse())
        .send({ number: '07', floor: '1º andar', wing: 'B', capacity: 1 })
        .expect(201);

      const response = await http()
        .patch(`${ROOMS}/${room.id}`)
        .set('Authorization', asNurse())
        .send({ capacity: 2, wing: null })
        .expect(200);
      expect(response.body).toMatchObject({
        number: '07',
        floor: '1º andar',
        wing: null,
        capacity: 2,
      });

      await http()
        .patch(`${ROOMS}/${room.id}`)
        .set('Authorization', asNurse())
        .send({ floor: null })
        .expect(400);
      await http()
        .patch(`${ROOMS}/${room.id}`)
        .set('Authorization', asCaregiver())
        .send({ capacity: 3 })
        .expect(403);
      await http()
        .patch(`${ROOMS}/${room.id}`)
        .set('Authorization', asOtherClinicNurse())
        .send({ capacity: 3 })
        .expect(403);
    });

    it('never lowers the capacity below the occupants nor repeats a number', async () => {
      const roomId = await createRoomWith(2, ['Maria Aparecida', 'Ana Souza']);
      const { body: otherRoom } = await http()
        .post(ROOMS)
        .set('Authorization', asNurse())
        .send({ number: '08', floor: '1º andar', capacity: 1 })
        .expect(201);

      await http()
        .patch(`${ROOMS}/${roomId}`)
        .set('Authorization', asNurse())
        .send({ capacity: 1 })
        .expect(409);
      await http()
        .patch(`${ROOMS}/${roomId}`)
        .set('Authorization', asNurse())
        .send({ number: otherRoom.number })
        .expect(409);
    });
  });

  describe('DELETE /rooms/:id', () => {
    it('deletes only empty rooms of the clinic', async () => {
      const emptyRoomId = await createRoomWith(1, []);
      const occupiedRoomId = await createRoomWith(1, ['Maria Aparecida']);

      await http()
        .delete(`${ROOMS}/${emptyRoomId}`)
        .set('Authorization', asCaregiver())
        .expect(403);
      await http()
        .delete(`${ROOMS}/${emptyRoomId}`)
        .set('Authorization', asOtherClinicNurse())
        .expect(403);
      await http()
        .delete(`${ROOMS}/${occupiedRoomId}`)
        .set('Authorization', asNurse())
        .expect(409);
      await http()
        .delete(`${ROOMS}/${emptyRoomId}`)
        .set('Authorization', asNurse())
        .expect(204);
      await http()
        .get(`${ROOMS}/${emptyRoomId}`)
        .set('Authorization', asNurse())
        .expect(404);
    });
  });
});
