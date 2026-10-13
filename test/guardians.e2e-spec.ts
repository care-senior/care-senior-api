import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { StaffRole, UserRole } from '../src/common/enums/index.js';
import {
  createTestApp,
  TEST_PASSWORD,
  uniqueEmail,
  type TestApp,
} from './support/test-app.js';

const GUARDIANS = '/api/v1/guardians';
const AUTH = '/api/v1/auth';

describe('Guardians (e2e)', () => {
  let testApp: TestApp;
  let clinicId: string;
  let roomId: string;
  let caregiver: { id: string };
  let nurse: { id: string };
  const http = () => request(testApp.app.getHttpServer());
  const sign = (payload: object) =>
    new JwtService({ secret: process.env.JWT_SECRET }).sign(payload);
  const asStaff = (
    staff: { id: string },
    staffRole: StaffRole,
    staffClinicId = clinicId,
  ) =>
    `Bearer ${sign({ sub: staff.id, role: UserRole.STAFF, staffRole, clinicId: staffClinicId })}`;
  const asGuardian = (guardian: { id: string }) =>
    `Bearer ${sign({ sub: guardian.id, role: UserRole.GUARDIAN })}`;

  const walkIn = (overrides: { email?: string; roomId?: string } = {}) => ({
    guardian: {
      name: 'Fernanda Costa',
      email: overrides.email ?? uniqueEmail('walk-in'),
      cpf: '529.982.247-25',
    },
    resident: {
      name: 'Maria Aparecida Souza',
      age: 82,
      roomId: overrides.roomId ?? roomId,
      mood: 'calm',
      emergencyContactName: 'Fernanda Costa (filha)',
      emergencyContactPhone: '(61) 99123-4567',
    },
  });

  beforeEach(async () => {
    testApp = await createTestApp();
    clinicId = await testApp.createClinic();
    roomId = await testApp.createRoom({ clinicId, capacity: 1 });
    caregiver = await testApp.createStaffMember({
      clinicId,
      staffRole: StaffRole.CAREGIVER,
    });
    nurse = await testApp.createStaffMember({
      clinicId,
      staffRole: StaffRole.NURSE,
    });
  });

  afterEach(async () => {
    await testApp.close();
  });

  describe('POST /guardians (walk-in)', () => {
    it('creates the guardian and the resident in the room, and the guardian joins through the invite', async () => {
      const body = walkIn();

      const response = await http()
        .post(GUARDIANS)
        .set('Authorization', asStaff(caregiver, StaffRole.CAREGIVER))
        .send(body)
        .expect(201);

      expect(response.body.guardian).toMatchObject({
        email: body.guardian.email,
        maskedCpf: '•••.•••.•••-25',
      });
      expect(response.body.guardian).not.toHaveProperty('contactedClinicIds');
      expect(response.body.resident).toMatchObject({
        name: 'Maria Aparecida Souza',
        clinicId,
        roomId,
        healthNotes: null,
        mood: 'calm',
      });

      const [mail] = testApp.mail.sendInvite.mock.lastCall as [
        { inviteUrl: string; role: UserRole },
      ];
      expect(mail.role).toBe(UserRole.GUARDIAN);
      const token = new URL(mail.inviteUrl).searchParams.get('token')!;

      await http()
        .post(`${AUTH}/staff/accept-invite`)
        .send({ token, password: 'brand-new-password' })
        .expect(400);
      await http()
        .post(`${AUTH}/guardian/accept-invite`)
        .send({ token, password: 'brand-new-password' })
        .expect(204);
      await http()
        .post(`${AUTH}/guardian/login`)
        .send({ email: body.guardian.email, password: 'brand-new-password' })
        .expect(200);
    });

    it('refuses a full room, a room of another clinic and a duplicated e-mail without leaving residents behind', async () => {
      await http()
        .post(GUARDIANS)
        .set('Authorization', asStaff(nurse, StaffRole.NURSE))
        .send(walkIn())
        .expect(201);
      await http()
        .post(GUARDIANS)
        .set('Authorization', asStaff(nurse, StaffRole.NURSE))
        .send(walkIn())
        .expect(409);

      const otherClinicRoom = await testApp.createRoom({
        clinicId: await testApp.createClinic(),
      });
      await http()
        .post(GUARDIANS)
        .set('Authorization', asStaff(nurse, StaffRole.NURSE))
        .send(walkIn({ roomId: otherClinicRoom }))
        .expect(403);

      const existing = await testApp.createGuardian();
      const emptyRoom = await testApp.createRoom({ clinicId });
      await http()
        .post(GUARDIANS)
        .set('Authorization', asStaff(nurse, StaffRole.NURSE))
        .send(walkIn({ email: existing.email, roomId: emptyRoom }))
        .expect(409);

      const [{ count }] = (await testApp.dataSource.query(
        'SELECT count(*)::int AS count FROM residents WHERE room_id = $1',
        [emptyRoom],
      )) as { count: number }[];
      expect(count).toBe(0);
    });

    it('validates the payload and refuses guardians', async () => {
      const response = await http()
        .post(GUARDIANS)
        .set('Authorization', asStaff(nurse, StaffRole.NURSE))
        .send({
          guardian: { name: '', email: 'x', cpf: '111.111.111-11' },
          resident: { name: 'X', age: -1, roomId: 'not-a-uuid' },
        })
        .expect(400);
      expect(response.body.message).toEqual(
        expect.arrayContaining([
          'guardian.cpf must be a valid CPF',
          'resident.age must not be less than 0',
          'resident.roomId must be a UUID',
        ]),
      );

      const guardian = await testApp.createGuardian();
      await http()
        .post(GUARDIANS)
        .set('Authorization', asGuardian(guardian))
        .send(walkIn())
        .expect(403);
    });
  });

  describe('GET and PATCH /guardians/:id', () => {
    it('shows a guardian to the clinic of their resident and to themselves only', async () => {
      const guardian = await testApp.createGuardian();
      await testApp.createResident({
        clinicId,
        roomId,
        guardianIds: [guardian.id],
      });
      const otherClinicNurse = await testApp.createStaffMember();

      await http()
        .get(`${GUARDIANS}/${guardian.id}`)
        .set('Authorization', asStaff(caregiver, StaffRole.CAREGIVER))
        .expect(200);
      await http()
        .get(`${GUARDIANS}/${guardian.id}`)
        .set(
          'Authorization',
          asStaff(otherClinicNurse, StaffRole.NURSE, randomUUID()),
        )
        .expect(403);
      await http()
        .get(`${GUARDIANS}/${guardian.id}`)
        .set('Authorization', asGuardian(await testApp.createGuardian()))
        .expect(403);

      const self = await http()
        .get(`${GUARDIANS}/${guardian.id}`)
        .set('Authorization', asGuardian(guardian))
        .expect(200);
      expect(self.body).toMatchObject({
        id: guardian.id,
        maskedCpf: '•••.•••.•••-25',
        contactedClinicIds: [],
      });
    });

    it('lets the staff edit a guardian of their clinic', async () => {
      const guardian = await testApp.createGuardian();
      await testApp.createResident({ clinicId, guardianIds: [guardian.id] });
      const email = uniqueEmail('edited');

      const response = await http()
        .patch(`${GUARDIANS}/${guardian.id}`)
        .set('Authorization', asStaff(caregiver, StaffRole.CAREGIVER))
        .send({ name: 'Fernanda C.', email: email.toUpperCase() })
        .expect(200);
      expect(response.body).toMatchObject({ name: 'Fernanda C.', email });
    });

    it('lets a guardian edit their own profile but not their e-mail', async () => {
      const guardian = await testApp.createGuardian();

      await http()
        .patch(`${GUARDIANS}/me`)
        .set('Authorization', asGuardian(guardian))
        .send({ name: 'Camila Torres', cpf: '123.456.789-09' })
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            name: 'Camila Torres',
            maskedCpf: '•••.•••.•••-09',
          });
        });
      await http()
        .patch(`${GUARDIANS}/me`)
        .set('Authorization', asGuardian(guardian))
        .send({ email: uniqueEmail('x') })
        .expect(400);
    });
  });

  describe('contact clinic and pending link requests', () => {
    it('puts a guardian with an unlinked resident in the link queue of the contacted clinic', async () => {
      const guardian = await testApp.createGuardian({
        password: TEST_PASSWORD,
      });
      const unlinkedResidentId = await testApp.createResident({
        name: 'Benedito Nogueira',
        guardianIds: [guardian.id],
      });
      await testApp.createResident({
        name: 'Linked Elsewhere',
        clinicId: await testApp.createClinic(),
        guardianIds: [guardian.id],
      });

      const queue = () =>
        http()
          .get(`${GUARDIANS}/pending-link-requests`)
          .set('Authorization', asStaff(nurse, StaffRole.NURSE))
          .expect(200);
      expect((await queue()).body.meta.total).toBe(0);

      for (let attempt = 0; attempt < 2; attempt++) {
        await http()
          .post(`${GUARDIANS}/${guardian.id}/contact-clinic`)
          .query({ clinicId })
          .set('Authorization', asGuardian(guardian))
          .expect(200)
          .expect(({ body }) => {
            expect(body.contactedClinicIds).toEqual([clinicId]);
          });
      }

      const { body } = await queue();
      expect(body.meta.total).toBe(1);
      expect(body.data[0].guardian).toMatchObject({ id: guardian.id });
      expect(body.data[0].guardian).not.toHaveProperty('contactedClinicIds');
      expect(body.data[0].residents).toEqual([
        expect.objectContaining({ id: unlinkedResidentId, clinicId: null }),
      ]);

      await http()
        .get(`${GUARDIANS}/${guardian.id}`)
        .set('Authorization', asStaff(nurse, StaffRole.NURSE))
        .expect(200);
    });

    it('restricts the queue to coordinators and nurses of the clinic', async () => {
      await http()
        .get(`${GUARDIANS}/pending-link-requests`)
        .set('Authorization', asStaff(caregiver, StaffRole.CAREGIVER))
        .expect(403);
      await http()
        .get(`${GUARDIANS}/pending-link-requests`)
        .query({ clinicId: randomUUID() })
        .set('Authorization', asStaff(nurse, StaffRole.NURSE))
        .expect(403);
    });

    it('only lets a guardian register their own contacts with existing clinics', async () => {
      const guardian = await testApp.createGuardian();
      const other = await testApp.createGuardian();

      await http()
        .post(`${GUARDIANS}/${other.id}/contact-clinic`)
        .query({ clinicId })
        .set('Authorization', asGuardian(guardian))
        .expect(403);
      await http()
        .post(`${GUARDIANS}/${guardian.id}/contact-clinic`)
        .query({ clinicId: randomUUID() })
        .set('Authorization', asGuardian(guardian))
        .expect(404);
      await http()
        .post(`${GUARDIANS}/${guardian.id}/contact-clinic`)
        .set('Authorization', asGuardian(guardian))
        .expect(400);
    });
  });
});
