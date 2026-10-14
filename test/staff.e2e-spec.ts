import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { StaffRole, UserRole } from '../src/common/enums/index.js';
import {
  createTestApp,
  TEST_PASSWORD,
  type TestApp,
} from './support/test-app.js';

const STAFF = '/api/v1/staff';
const AUTH = '/api/v1/auth';

interface InviteMail {
  to: string;
  inviteUrl: string;
}

describe('Staff (e2e)', () => {
  let testApp: TestApp;
  let clinicId: string;
  let coordinator: { id: string; email: string };
  let nurse: { id: string; email: string };
  let caregiver: { id: string; email: string };
  const http = () => request(testApp.app.getHttpServer());
  const tokenFor = (
    staff: { id: string },
    staffRole: StaffRole,
    staffClinicId = clinicId,
  ) =>
    new JwtService({ secret: process.env.JWT_SECRET }).sign({
      sub: staff.id,
      role: UserRole.STAFF,
      staffRole,
      clinicId: staffClinicId,
    });
  const as = (staff: { id: string }, staffRole: StaffRole) =>
    `Bearer ${tokenFor(staff, staffRole)}`;
  const uniqueEmail = () => `new-staff-${randomUUID()}@e2e.caresenior.dev`;

  beforeEach(async () => {
    testApp = await createTestApp();
    clinicId = await testApp.createClinic();
    coordinator = await testApp.createStaffMember({
      clinicId,
      staffRole: StaffRole.COORDINATOR,
    });
    nurse = await testApp.createStaffMember({
      clinicId,
      staffRole: StaffRole.NURSE,
    });
    caregiver = await testApp.createStaffMember({
      clinicId,
      staffRole: StaffRole.CAREGIVER,
    });
  });

  afterEach(async () => {
    await testApp.close();
  });

  function lastInviteToken(): string {
    const [mail] = testApp.mail.sendInvite.mock.lastCall as [InviteMail];
    return new URL(mail.inviteUrl).searchParams.get('token')!;
  }

  describe('GET /staff', () => {
    it('lists only the active staff of the caller clinic', async () => {
      const otherClinicStaff = await testApp.createStaffMember();
      await http()
        .delete(`${STAFF}/${caregiver.id}`)
        .set('Authorization', as(coordinator, StaffRole.COORDINATOR))
        .expect(204);

      const response = await http()
        .get(STAFF)
        .set('Authorization', as(caregiver, StaffRole.CAREGIVER))
        .expect(200);

      const ids = (response.body.data as { id: string }[]).map(({ id }) => id);
      expect(ids).toEqual(expect.arrayContaining([coordinator.id, nurse.id]));
      expect(ids).not.toContain(caregiver.id);
      expect(ids).not.toContain(otherClinicStaff.id);
      expect(response.body.meta.total).toBe(2);

      const withInactive = await http()
        .get(STAFF)
        .query({ includeInactive: true, staffRole: StaffRole.CAREGIVER })
        .set('Authorization', as(nurse, StaffRole.NURSE))
        .expect(200);
      expect(withInactive.body.data).toEqual([
        expect.objectContaining({
          id: caregiver.id,
          deactivatedAt: expect.any(String),
        }),
      ]);
    });

    it('refuses another clinic id and guardians', async () => {
      await http()
        .get(STAFF)
        .query({ clinicId: randomUUID() })
        .set('Authorization', as(nurse, StaffRole.NURSE))
        .expect(403);

      const guardianToken = new JwtService({
        secret: process.env.JWT_SECRET,
      }).sign({ sub: randomUUID(), role: UserRole.GUARDIAN });
      await http()
        .get(STAFF)
        .set('Authorization', `Bearer ${guardianToken}`)
        .expect(403);
    });
  });

  describe('POST /staff and invite', () => {
    it('creates a staff member who sets a password through the invite and logs in', async () => {
      const email = uniqueEmail();

      const created = await http()
        .post(STAFF)
        .set('Authorization', as(nurse, StaffRole.NURSE))
        .send({
          name: 'Larissa Prado',
          email: email.toUpperCase(),
          staffRole: StaffRole.CAREGIVER,
          cpf: '529.982.247-25',
        })
        .expect(201);

      expect(created.body).toMatchObject({
        email,
        clinicId,
        staffRole: StaffRole.CAREGIVER,
        maskedCpf: '•••.•••.•••-25',
        deactivatedAt: null,
      });
      expect(created.body).not.toHaveProperty('cpf');
      expect(created.body).not.toHaveProperty('password');

      await http()
        .post(`${AUTH}/staff/login`)
        .send({ email, password: 'any-password' })
        .expect(401);

      const token = lastInviteToken();
      await http()
        .post(`${AUTH}/staff/accept-invite`)
        .send({ token, password: 'brand-new-password' })
        .expect(204);
      await http()
        .post(`${AUTH}/staff/accept-invite`)
        .send({ token, password: 'another-password' })
        .expect(400);

      await http()
        .post(`${AUTH}/staff/login`)
        .send({ email, password: 'brand-new-password' })
        .expect(200);
    });

    it('does not let an old invite overwrite a password set in the meantime', async () => {
      const email = uniqueEmail();
      await http()
        .post(STAFF)
        .set('Authorization', as(nurse, StaffRole.NURSE))
        .send({ name: 'Larissa Prado', email, staffRole: StaffRole.CAREGIVER })
        .expect(201);
      const inviteToken = lastInviteToken();

      await http()
        .post(`${AUTH}/staff/forgot-password`)
        .send({ email })
        .expect(204);
      const [resetMail] = testApp.mail.sendPasswordReset.mock.lastCall as [
        { resetUrl: string },
      ];
      await http()
        .post(`${AUTH}/reset-password`)
        .send({
          token: new URL(resetMail.resetUrl).searchParams.get('token'),
          password: 'chosen-by-the-owner',
        })
        .expect(204);

      await http()
        .post(`${AUTH}/staff/accept-invite`)
        .send({ token: inviteToken, password: 'from-the-old-invite' })
        .expect(400);
      await http()
        .post(`${AUTH}/staff/login`)
        .send({ email, password: 'chosen-by-the-owner' })
        .expect(200);
    });

    it('validates the payload and rejects duplicated e-mails', async () => {
      const response = await http()
        .post(STAFF)
        .set('Authorization', as(coordinator, StaffRole.COORDINATOR))
        .send({
          name: '',
          email: 'x',
          staffRole: 'boss',
          cpf: '123.456.789-00',
        })
        .expect(400);
      expect(response.body.message).toEqual(
        expect.arrayContaining([
          'cpf must be a valid CPF',
          'email must be an email',
        ]),
      );

      await http()
        .post(STAFF)
        .set('Authorization', as(coordinator, StaffRole.COORDINATOR))
        .send({ name: 'Copy', email: nurse.email, staffRole: StaffRole.NURSE })
        .expect(409);
    });

    it('only lets coordinators and nurses manage staff, and only coordinators manage coordinators', async () => {
      const body = (staffRole: StaffRole) => ({
        name: 'New',
        email: uniqueEmail(),
        staffRole,
      });

      await http()
        .post(STAFF)
        .set('Authorization', as(caregiver, StaffRole.CAREGIVER))
        .send(body(StaffRole.CAREGIVER))
        .expect(403);
      await http()
        .post(STAFF)
        .set('Authorization', as(nurse, StaffRole.NURSE))
        .send(body(StaffRole.COORDINATOR))
        .expect(403);
      await http()
        .post(STAFF)
        .set('Authorization', as(coordinator, StaffRole.COORDINATOR))
        .send(body(StaffRole.COORDINATOR))
        .expect(201);
    });
  });

  describe('GET and PATCH /staff/me', () => {
    it('returns and updates the own profile', async () => {
      await http()
        .patch(`${STAFF}/me`)
        .set('Authorization', as(caregiver, StaffRole.CAREGIVER))
        .send({ name: 'Bruno K.', cpf: '52998224725' })
        .expect(200);

      const response = await http()
        .get(`${STAFF}/me`)
        .set('Authorization', as(caregiver, StaffRole.CAREGIVER))
        .expect(200);
      expect(response.body).toMatchObject({
        id: caregiver.id,
        name: 'Bruno K.',
        maskedCpf: '•••.•••.•••-25',
      });
    });

    it('does not let staff change their own role or e-mail', async () => {
      await http()
        .patch(`${STAFF}/me`)
        .set('Authorization', as(caregiver, StaffRole.CAREGIVER))
        .send({ staffRole: StaffRole.COORDINATOR })
        .expect(400);
    });

    it('rejects null on required fields', async () => {
      await http()
        .patch(`${STAFF}/me`)
        .set('Authorization', as(caregiver, StaffRole.CAREGIVER))
        .send({ name: null })
        .expect(400);
    });
  });

  describe('GET and PATCH /staff/:id', () => {
    it('updates a staff member, including the role', async () => {
      const response = await http()
        .patch(`${STAFF}/${caregiver.id}`)
        .set('Authorization', as(nurse, StaffRole.NURSE))
        .send({ staffRole: StaffRole.NURSE })
        .expect(200);
      expect(response.body).toMatchObject({
        id: caregiver.id,
        staffRole: StaffRole.NURSE,
      });

      await http()
        .get(`${STAFF}/${caregiver.id}`)
        .set('Authorization', as(coordinator, StaffRole.COORDINATOR))
        .expect(200)
        .expect(({ body }) => {
          expect(body.staffRole).toBe(StaffRole.NURSE);
        });
    });

    it('fixes the e-mail of someone not activated yet, and only the new address activates', async () => {
      const created = await http()
        .post(STAFF)
        .set('Authorization', as(nurse, StaffRole.NURSE))
        .send({
          name: 'Larissa Prado',
          email: uniqueEmail(),
          staffRole: StaffRole.CAREGIVER,
        })
        .expect(201);
      const typoToken = lastInviteToken();
      const corrected = uniqueEmail();

      await http()
        .patch(`${STAFF}/${created.body.id}`)
        .set('Authorization', as(nurse, StaffRole.NURSE))
        .send({ email: corrected })
        .expect(200);
      const [mail] = testApp.mail.sendInvite.mock.lastCall as [InviteMail];
      expect(mail.to).toBe(corrected);

      await http()
        .post(`${AUTH}/staff/accept-invite`)
        .send({ token: typoToken, password: 'owned-by-the-typo' })
        .expect(400);
      await http()
        .post(`${AUTH}/staff/accept-invite`)
        .send({ token: lastInviteToken(), password: 'brand-new-password' })
        .expect(204);
      await http()
        .post(`${AUTH}/staff/login`)
        .send({ email: corrected, password: 'brand-new-password' })
        .expect(200);
    });

    it('never changes the e-mail of an activated account, so nobody takes it over', async () => {
      const inviteCount = testApp.mail.sendInvite.mock.calls.length;

      await http()
        .patch(`${STAFF}/${caregiver.id}`)
        .set('Authorization', as(nurse, StaffRole.NURSE))
        .send({ email: uniqueEmail() })
        .expect(409);
      await http()
        .patch(`${STAFF}/${caregiver.id}`)
        .set('Authorization', as(nurse, StaffRole.NURSE))
        .send({ name: 'Bruno K.', email: caregiver.email })
        .expect(200);

      expect(testApp.mail.sendInvite.mock.calls.length).toBe(inviteCount);
      await http()
        .post(`${AUTH}/staff/login`)
        .send({ email: caregiver.email, password: TEST_PASSWORD })
        .expect(200);
    });

    it('keeps the clinic with at least one active coordinator', async () => {
      await http()
        .patch(`${STAFF}/${coordinator.id}`)
        .set('Authorization', as(coordinator, StaffRole.COORDINATOR))
        .send({ staffRole: StaffRole.NURSE })
        .expect(409);
    });

    it('hides staff members of other clinics', async () => {
      const otherClinicStaff = await testApp.createStaffMember();

      await http()
        .get(`${STAFF}/${otherClinicStaff.id}`)
        .set('Authorization', as(nurse, StaffRole.NURSE))
        .expect(403);
      await http()
        .get(`${STAFF}/${randomUUID()}`)
        .set('Authorization', as(nurse, StaffRole.NURSE))
        .expect(404);
    });
  });

  describe('DELETE /staff/:id', () => {
    it('deactivates the staff member and ends their access', async () => {
      const login = await http()
        .post(`${AUTH}/staff/login`)
        .send({ email: caregiver.email, password: TEST_PASSWORD })
        .expect(200);

      await http()
        .delete(`${STAFF}/${caregiver.id}`)
        .set('Authorization', as(nurse, StaffRole.NURSE))
        .expect(204);

      await http()
        .post(`${AUTH}/refresh`)
        .send({ refreshToken: login.body.refreshToken })
        .expect(401);
      await http()
        .post(`${AUTH}/staff/login`)
        .send({ email: caregiver.email, password: TEST_PASSWORD })
        .expect(401);
    });

    it('refuses self deactivation and the last coordinator', async () => {
      await http()
        .delete(`${STAFF}/${nurse.id}`)
        .set('Authorization', as(nurse, StaffRole.NURSE))
        .expect(409);

      const secondCoordinator = await testApp.createStaffMember({
        clinicId,
        staffRole: StaffRole.COORDINATOR,
      });
      await http()
        .delete(`${STAFF}/${secondCoordinator.id}`)
        .set('Authorization', as(coordinator, StaffRole.COORDINATOR))
        .expect(204);
      await http()
        .delete(`${STAFF}/${coordinator.id}`)
        .set(
          'Authorization',
          `Bearer ${tokenFor(secondCoordinator, StaffRole.COORDINATOR)}`,
        )
        .expect(409);
    });

    it('does not let a nurse deactivate a coordinator', async () => {
      await http()
        .delete(`${STAFF}/${coordinator.id}`)
        .set('Authorization', as(nurse, StaffRole.NURSE))
        .expect(403);
    });
  });
});
