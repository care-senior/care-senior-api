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

const AUTH = '/api/v1/auth';

describe('Auth (e2e)', () => {
  let testApp: TestApp;
  const http = () => request(testApp.app.getHttpServer());

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  function loginStaff(email: string, password = TEST_PASSWORD) {
    return http().post(`${AUTH}/staff/login`).send({ email, password });
  }

  describe('login', () => {
    it('returns tokens and the staff profile', async () => {
      const staff = await testApp.createStaffMember({
        staffRole: StaffRole.COORDINATOR,
      });

      const response = await loginStaff(staff.email.toUpperCase()).expect(200);

      expect(response.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: 900,
        user: {
          id: staff.id,
          role: UserRole.STAFF,
          email: staff.email,
          staffRole: StaffRole.COORDINATOR,
          clinicId: expect.any(String),
        },
      });
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body.user).not.toHaveProperty('cpf');
    });

    it('rejects a wrong password and an account without password', async () => {
      const staff = await testApp.createStaffMember();
      const invited = await testApp.createStaffMember({ password: null });

      await loginStaff(staff.email, 'wrong-password').expect(401);
      await loginStaff(invited.email, 'any-password').expect(401);
    });

    it('keeps staff and guardian accounts apart', async () => {
      const guardian = await testApp.createGuardian();

      await loginStaff(guardian.email).expect(401);
      await http()
        .post(`${AUTH}/guardian/login`)
        .send({ email: guardian.email, password: TEST_PASSWORD })
        .expect(200);
    });

    it('validates the payload', async () => {
      const response = await http()
        .post(`${AUTH}/staff/login`)
        .send({ email: 'not-an-email', password: '' })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining(['email must be an email']),
      );
    });

    it('throttles repeated attempts for the same e-mail', async () => {
      const staff = await testApp.createStaffMember();
      for (let attempt = 0; attempt < 5; attempt++) {
        await loginStaff(staff.email, 'wrong-password').expect(401);
      }
      await loginStaff(staff.email).expect(429);
    });
  });

  describe('guardian register', () => {
    const signup = (email: string, residentName = 'Benedito Nogueira') => ({
      guardian: {
        name: 'Camila Torres',
        email,
        cpf: '529.982.247-25',
        password: 'my-own-password',
      },
      resident: { name: residentName, age: 79, mood: 'cheerful' },
    });

    it('creates the guardian with an unlinked resident and starts a session', async () => {
      const email = uniqueEmail('signup');

      const response = await http()
        .post(`${AUTH}/guardian/register`)
        .send(signup(email))
        .expect(201);

      expect(response.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: { role: UserRole.GUARDIAN, email, name: 'Camila Torres' },
      });
      const residents = await http()
        .get('/api/v1/residents')
        .set('Authorization', `Bearer ${response.body.accessToken}`)
        .expect(200);
      expect(residents.body.data).toEqual([
        expect.objectContaining({
          name: 'Benedito Nogueira',
          mood: 'cheerful',
          clinicId: null,
        }),
      ]);
      await http()
        .post(`${AUTH}/guardian/login`)
        .send({ email, password: 'my-own-password' })
        .expect(200);
    });

    it('rejects a duplicated e-mail without leaving the resident behind, and a short password', async () => {
      const email = uniqueEmail('signup');
      const residentName = `Resident ${randomUUID()}`;
      await testApp.createGuardian({ email });

      await http()
        .post(`${AUTH}/guardian/register`)
        .send(signup(email, residentName))
        .expect(409);
      const [{ count }] = (await testApp.dataSource.query(
        'SELECT count(*)::int AS count FROM residents WHERE name = $1',
        [residentName],
      )) as { count: number }[];
      expect(count).toBe(0);

      const body = signup(uniqueEmail('signup'));
      body.guardian.password = 'short';
      await http().post(`${AUTH}/guardian/register`).send(body).expect(400);
    });
  });

  describe('session', () => {
    it('protects routes with the access token', async () => {
      const staff = await testApp.createStaffMember();
      const { body } = await loginStaff(staff.email);

      await http().get(`${AUTH}/me`).expect(401);
      const me = await http()
        .get(`${AUTH}/me`)
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);
      expect(me.body).toMatchObject({ id: staff.id, role: UserRole.STAFF });
    });

    it('accepts a token signed with JWT_SECRET as described in the guide', async () => {
      const staff = await testApp.createStaffMember({
        staffRole: StaffRole.NURSE,
      });
      const token = new JwtService({ secret: process.env.JWT_SECRET }).sign({
        sub: staff.id,
        role: UserRole.STAFF,
        staffRole: StaffRole.NURSE,
      });

      await http()
        .get(`${AUTH}/me`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('rotates the refresh token and ends the session when an old one is replayed', async () => {
      const staff = await testApp.createStaffMember();
      const { body: login } = await loginStaff(staff.email);

      const { body: refreshed } = await http()
        .post(`${AUTH}/refresh`)
        .send({ refreshToken: login.refreshToken })
        .expect(200);
      expect(refreshed.refreshToken).not.toBe(login.refreshToken);

      await http()
        .post(`${AUTH}/refresh`)
        .send({ refreshToken: login.refreshToken })
        .expect(401);
      await http()
        .post(`${AUTH}/refresh`)
        .send({ refreshToken: refreshed.refreshToken })
        .expect(401);
    });

    it('revokes the session on logout', async () => {
      const staff = await testApp.createStaffMember();
      const { body } = await loginStaff(staff.email);

      await http()
        .post(`${AUTH}/logout`)
        .send({ refreshToken: body.refreshToken })
        .expect(204);
      await http()
        .post(`${AUTH}/refresh`)
        .send({ refreshToken: body.refreshToken })
        .expect(401);
    });

    it('uses an httpOnly cookie for the web app', async () => {
      const staff = await testApp.createStaffMember();
      const agent = request.agent(testApp.app.getHttpServer());

      const login = await agent
        .post(`${AUTH}/staff/login`)
        .set('X-Client-Platform', 'web')
        .send({ email: staff.email, password: TEST_PASSWORD })
        .expect(200);

      expect(login.body).not.toHaveProperty('refreshToken');
      const cookie = String(login.headers['set-cookie']);
      expect(cookie).toMatch(/care_senior_refresh_token=.+;/);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Path=/api/v1/auth');
      expect(cookie).toContain('SameSite=Strict');

      const refreshed = await agent
        .post(`${AUTH}/refresh`)
        .set('X-Client-Platform', 'web')
        .expect(200);
      expect(refreshed.body.accessToken).toEqual(expect.any(String));

      await agent.post(`${AUTH}/logout`).expect(204);
      await agent.post(`${AUTH}/refresh`).expect(401);
    });
  });

  describe('password reset', () => {
    function lastResetToken() {
      const [mail] = testApp.mail.sendPasswordReset.mock.lastCall as [
        { resetUrl: string },
      ];
      return new URL(mail.resetUrl).searchParams.get('token')!;
    }

    it('answers the same way for unknown e-mails and sends nothing', async () => {
      testApp.mail.sendPasswordReset.mockClear();

      await http()
        .post(`${AUTH}/staff/forgot-password`)
        .send({ email: 'nobody@e2e.caresenior.dev' })
        .expect(204);
      expect(testApp.mail.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('resets the password once and ends existing sessions', async () => {
      const staff = await testApp.createStaffMember();
      const { body: session } = await loginStaff(staff.email);

      await http()
        .post(`${AUTH}/staff/forgot-password`)
        .send({ email: staff.email })
        .expect(204);
      const token = lastResetToken();

      await http()
        .post(`${AUTH}/reset-password`)
        .send({ token, password: 'brand-new-password' })
        .expect(204);
      await http()
        .post(`${AUTH}/reset-password`)
        .send({ token, password: 'another-password' })
        .expect(400);

      await http()
        .post(`${AUTH}/refresh`)
        .send({ refreshToken: session.refreshToken })
        .expect(401);
      await loginStaff(staff.email).expect(401);
      await loginStaff(staff.email, 'brand-new-password').expect(200);
    });

    it('invalidates older reset links when a new one is requested', async () => {
      const guardian = await testApp.createGuardian();
      const forgot = () =>
        http()
          .post(`${AUTH}/guardian/forgot-password`)
          .send({ email: guardian.email })
          .expect(204);

      await forgot();
      const firstToken = lastResetToken();
      await forgot();

      await http()
        .post(`${AUTH}/reset-password`)
        .send({ token: firstToken, password: 'brand-new-password' })
        .expect(400);
      await http()
        .post(`${AUTH}/reset-password`)
        .send({ token: lastResetToken(), password: 'brand-new-password' })
        .expect(204);
    });
  });
});
