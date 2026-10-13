import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { StaffRole, UserRole } from '../src/common/enums/index.js';
import {
  createTestApp,
  TEST_PASSWORD,
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
    it('devolve os tokens e o perfil do colaborador', async () => {
      const staff = await testApp.createStaffMember({
        role: StaffRole.COORDINATOR,
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

    it('recusa senha errada e conta ainda sem senha', async () => {
      const staff = await testApp.createStaffMember();
      const invited = await testApp.createStaffMember({ password: null });

      await loginStaff(staff.email, 'wrong-password').expect(401);
      await loginStaff(invited.email, 'any-password').expect(401);
    });

    it('separa contas de colaborador e de responsável', async () => {
      const guardian = await testApp.createGuardian();

      await loginStaff(guardian.email).expect(401);
      await http()
        .post(`${AUTH}/guardian/login`)
        .send({ email: guardian.email, password: TEST_PASSWORD })
        .expect(200);
    });

    it('valida o corpo da requisição', async () => {
      const response = await http()
        .post(`${AUTH}/staff/login`)
        .send({ email: 'not-an-email', password: '' })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining(['email must be an email']),
      );
    });

    it('limita tentativas repetidas para o mesmo e-mail', async () => {
      const staff = await testApp.createStaffMember();
      for (let attempt = 0; attempt < 5; attempt++) {
        await loginStaff(staff.email, 'wrong-password').expect(401);
      }
      await loginStaff(staff.email).expect(429);
    });
  });

  describe('sessão', () => {
    it('protege as rotas com o access token', async () => {
      const staff = await testApp.createStaffMember();
      const { body } = await loginStaff(staff.email);

      await http().get(`${AUTH}/me`).expect(401);
      const me = await http()
        .get(`${AUTH}/me`)
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);
      expect(me.body).toMatchObject({ id: staff.id, role: UserRole.STAFF });
    });

    it('aceita um token assinado com JWT_SECRET no formato do guia', async () => {
      const staff = await testApp.createStaffMember({ role: StaffRole.NURSE });
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

    it('gira o refresh token e encerra a sessão quando um antigo é reapresentado', async () => {
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

    it('revoga a sessão no logout', async () => {
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

    it('usa cookie httpOnly para o web app', async () => {
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

  describe('redefinição de senha', () => {
    function lastResetToken() {
      const [mail] = testApp.mail.sendPasswordReset.mock.lastCall as [
        { resetUrl: string },
      ];
      return new URL(mail.resetUrl).searchParams.get('token')!;
    }

    it('responde igual para e-mail desconhecido e não envia nada', async () => {
      testApp.mail.sendPasswordReset.mockClear();

      await http()
        .post(`${AUTH}/staff/forgot-password`)
        .send({ email: 'nobody@e2e.caresenior.dev' })
        .expect(204);
      expect(testApp.mail.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('redefine a senha uma única vez e encerra as sessões', async () => {
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

    it('invalida o link anterior quando um novo é pedido', async () => {
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
