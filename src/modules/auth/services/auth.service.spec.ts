import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { StaffRole, UserRole } from '../../../common/enums/index.js';
import { MailService } from '../../../infra/mail/services/mail.service.js';
import {
  AccountsService,
  type AccountWithPassword,
} from './accounts.service.js';
import { AuthService } from './auth.service.js';
import { JwtTokensService } from './jwt-tokens.service.js';
import { OneTimeTokensService } from './one-time-tokens.service.js';
import { PasswordService } from './password.service.js';
import { SessionsService } from './sessions.service.js';

describe('AuthService', () => {
  let service: AuthService;
  const accounts = {
    findByEmailWithPassword: vi.fn(),
    findById: vi.fn(),
    updatePassword: vi.fn(),
    createGuardianWithResident: vi.fn(),
  };
  const passwords = { verify: vi.fn(), hash: vi.fn() };
  const jwtTokens = {
    refreshTokenTtlMs: 1_000,
    signAccessToken: vi.fn(),
    signRefreshToken: vi.fn(),
    verifyRefreshToken: vi.fn(),
  };
  const sessions = {
    start: vi.fn(),
    rotate: vi.fn(),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
  };
  const oneTimeTokens = { issue: vi.fn(), consume: vi.fn() };
  const mail = { sendPasswordReset: vi.fn() };

  const coordinator: AccountWithPassword = {
    id: 'staff-1',
    role: UserRole.STAFF,
    name: 'Renata Alencar',
    email: 'renata@clinica.com',
    staffRole: StaffRole.COORDINATOR,
    clinicId: 'clinic-1',
    passwordHash: '$argon2id$hash',
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AccountsService, useValue: accounts },
        { provide: PasswordService, useValue: passwords },
        { provide: JwtTokensService, useValue: jwtTokens },
        { provide: SessionsService, useValue: sessions },
        { provide: OneTimeTokensService, useValue: oneTimeTokens },
        { provide: MailService, useValue: mail },
        {
          provide: ConfigService,
          useValue: {
            get: () => 'https://app.caresenior.dev/redefinir-senha',
          },
        },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  describe('registerGuardian', () => {
    it('stores only the password hash and starts a session for the new guardian', async () => {
      const guardian = {
        id: 'guardian-1',
        role: UserRole.GUARDIAN,
        name: 'Camila Torres',
        email: 'camila@familia.com',
      };
      passwords.hash.mockResolvedValue('$argon2id$hash');
      accounts.createGuardianWithResident.mockResolvedValue(guardian);
      sessions.start.mockResolvedValue({ id: 'session-1' });
      jwtTokens.signAccessToken.mockResolvedValue({
        accessToken: 'access',
        expiresIn: 900,
      });
      jwtTokens.signRefreshToken.mockResolvedValue('refresh');
      const resident = { name: 'Benedito Nogueira', age: 79 };

      const result = await service.registerGuardian({
        guardian: {
          name: guardian.name,
          email: guardian.email,
          cpf: '52998224725',
          password: 'my-own-password',
        },
        resident,
      });

      expect(accounts.createGuardianWithResident).toHaveBeenCalledWith(
        expect.objectContaining({ password: '$argon2id$hash' }),
        resident,
      );
      expect(sessions.start).toHaveBeenCalledWith(guardian, 1_000);
      expect(result).toMatchObject({
        accessToken: 'access',
        refreshToken: 'refresh',
        user: { id: 'guardian-1', role: UserRole.GUARDIAN },
      });
    });
  });

  describe('login', () => {
    it('starts a session and never exposes the password hash', async () => {
      accounts.findByEmailWithPassword.mockResolvedValue(coordinator);
      passwords.verify.mockResolvedValue(true);
      sessions.start.mockResolvedValue({ id: 'session-1' });
      jwtTokens.signAccessToken.mockResolvedValue({
        accessToken: 'access',
        expiresIn: 900,
      });
      jwtTokens.signRefreshToken.mockResolvedValue('refresh');

      const result = await service.login(UserRole.STAFF, {
        email: coordinator.email,
        password: 'correct-password',
      });

      expect(result).toMatchObject({
        accessToken: 'access',
        refreshToken: 'refresh',
        user: { id: 'staff-1', staffRole: StaffRole.COORDINATOR },
      });
      expect(sessions.start).toHaveBeenCalledWith(
        expect.not.objectContaining({ passwordHash: expect.anything() }),
        jwtTokens.refreshTokenTtlMs,
      );
    });

    it('still verifies a password when the account does not exist', async () => {
      accounts.findByEmailWithPassword.mockResolvedValue(null);
      passwords.verify.mockResolvedValue(false);

      await expect(
        service.login(UserRole.STAFF, {
          email: 'x@y.com',
          password: 'any-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(passwords.verify).toHaveBeenCalledWith(undefined, 'any-password');
      expect(sessions.start).not.toHaveBeenCalled();
    });
  });

  describe('requestPasswordReset', () => {
    it('sends nothing for an unknown e-mail', async () => {
      accounts.findByEmailWithPassword.mockResolvedValue(null);

      await service.requestPasswordReset(UserRole.STAFF, 'x@y.com');

      expect(oneTimeTokens.issue).not.toHaveBeenCalled();
      expect(mail.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('e-mails the reset link and swallows SMTP failures', async () => {
      accounts.findByEmailWithPassword.mockResolvedValue(coordinator);
      oneTimeTokens.issue.mockResolvedValue('token-123');
      mail.sendPasswordReset.mockRejectedValue(new Error('SMTP is down'));

      await expect(
        service.requestPasswordReset(UserRole.STAFF, coordinator.email),
      ).resolves.toBeUndefined();
      expect(mail.sendPasswordReset).toHaveBeenCalledWith({
        to: coordinator.email,
        name: coordinator.name,
        resetUrl: 'https://app.caresenior.dev/redefinir-senha?token=token-123',
      });
    });
  });

  describe('acceptInvite', () => {
    it('sets the password of the invited account', async () => {
      oneTimeTokens.consume.mockResolvedValue({
        userId: 'staff-1',
        userRole: UserRole.STAFF,
      });
      accounts.findById.mockResolvedValue(coordinator);
      passwords.hash.mockResolvedValue('new-hash');

      await service.acceptInvite(UserRole.STAFF, {
        token: 'invite-token',
        password: 'new-password',
      });

      expect(oneTimeTokens.consume).toHaveBeenCalledWith(
        'invite-token',
        'invite',
        UserRole.STAFF,
      );
      expect(accounts.updatePassword).toHaveBeenCalledWith(
        UserRole.STAFF,
        'staff-1',
        'new-hash',
      );
    });

    it('rejects the invite of a deactivated account', async () => {
      oneTimeTokens.consume.mockResolvedValue({
        userId: 'staff-1',
        userRole: UserRole.STAFF,
      });
      accounts.findById.mockResolvedValue(null);

      await expect(
        service.acceptInvite(UserRole.STAFF, {
          token: 'invite-token',
          password: 'new-password',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(accounts.updatePassword).not.toHaveBeenCalled();
    });
  });

  it('resetPassword stores the new password and ends every session', async () => {
    oneTimeTokens.consume.mockResolvedValue({
      userId: 'staff-1',
      userRole: UserRole.STAFF,
    });
    passwords.hash.mockResolvedValue('new-hash');

    await service.resetPassword({
      token: 'token-123',
      password: 'new-password',
    });

    expect(accounts.updatePassword).toHaveBeenCalledWith(
      UserRole.STAFF,
      'staff-1',
      'new-hash',
    );
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(
      'staff-1',
      UserRole.STAFF,
    );
  });
});
