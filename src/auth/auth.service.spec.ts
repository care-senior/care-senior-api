import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { StaffRole, UserRole } from '../common/enums/index.js';
import { MailService } from '../mail/mail.service.js';
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
            get: () => 'https://painel.caresenior.app/redefinir-senha',
          },
        },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  describe('login', () => {
    it('abre a sessão e não devolve o hash da senha', async () => {
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
        password: 'senha-correta',
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

    it('verifica a senha mesmo quando a conta não existe', async () => {
      accounts.findByEmailWithPassword.mockResolvedValue(null);
      passwords.verify.mockResolvedValue(false);

      await expect(
        service.login(UserRole.STAFF, {
          email: 'x@y.com',
          password: 'qualquer',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(passwords.verify).toHaveBeenCalledWith(undefined, 'qualquer');
      expect(sessions.start).not.toHaveBeenCalled();
    });
  });

  describe('requestPasswordReset', () => {
    it('não envia e-mail para conta inexistente', async () => {
      accounts.findByEmailWithPassword.mockResolvedValue(null);

      await service.requestPasswordReset(UserRole.STAFF, 'x@y.com');

      expect(oneTimeTokens.issue).not.toHaveBeenCalled();
      expect(mail.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('envia o link com o token e não propaga falha de SMTP', async () => {
      accounts.findByEmailWithPassword.mockResolvedValue(coordinator);
      oneTimeTokens.issue.mockResolvedValue('token-123');
      mail.sendPasswordReset.mockRejectedValue(new Error('SMTP fora do ar'));

      await expect(
        service.requestPasswordReset(UserRole.STAFF, coordinator.email),
      ).resolves.toBeUndefined();
      expect(mail.sendPasswordReset).toHaveBeenCalledWith({
        to: coordinator.email,
        name: coordinator.name,
        resetUrl:
          'https://painel.caresenior.app/redefinir-senha?token=token-123',
      });
    });
  });

  it('resetPassword grava a nova senha e encerra todas as sessões', async () => {
    oneTimeTokens.consume.mockResolvedValue({
      userId: 'staff-1',
      userRole: UserRole.STAFF,
    });
    passwords.hash.mockResolvedValue('novo-hash');

    await service.resetPassword({ token: 'token-123', password: 'nova-senha' });

    expect(accounts.updatePassword).toHaveBeenCalledWith(
      UserRole.STAFF,
      'staff-1',
      'novo-hash',
    );
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(
      'staff-1',
      UserRole.STAFF,
    );
  });
});
