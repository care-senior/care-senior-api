import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserRole } from '../common/enums/index.js';
import { AuthSession } from './entities/auth-session.entity.js';
import type { RefreshTokenPayload } from './jwt-tokens.service.js';
import { SessionsService } from './sessions.service.js';

describe('SessionsService', () => {
  let service: SessionsService;
  let sessionRepository: {
    findOneBy: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  const activeSession = (): AuthSession =>
    Object.assign(new AuthSession(), {
      id: 'session-1',
      userId: 'staff-1',
      userRole: UserRole.STAFF,
      refreshTokenId: 'token-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });

  const refreshToken = (jti: string): RefreshTokenPayload => ({
    sub: 'staff-1',
    role: UserRole.STAFF,
    sid: 'session-1',
    jti,
  });

  beforeEach(async () => {
    sessionRepository = {
      findOneBy: vi.fn(),
      save: vi.fn((session: AuthSession) => Promise.resolve(session)),
      update: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        SessionsService,
        {
          provide: getRepositoryToken(AuthSession),
          useValue: sessionRepository,
        },
      ],
    }).compile();
    service = module.get(SessionsService);
  });

  it('gira o identificador do refresh token', async () => {
    sessionRepository.findOneBy.mockResolvedValue(activeSession());

    const rotated = await service.rotate(refreshToken('token-1'));

    expect(rotated.refreshTokenId).not.toBe('token-1');
    expect(sessionRepository.update).not.toHaveBeenCalled();
  });

  it('revoga a sessão quando um refresh token antigo é reapresentado', async () => {
    sessionRepository.findOneBy.mockResolvedValue(activeSession());

    await expect(
      service.rotate(refreshToken('token-antigo')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-1' }),
      { revokedAt: expect.any(Date) },
    );
  });

  it('recusa sessão revogada ou expirada', async () => {
    sessionRepository.findOneBy.mockResolvedValueOnce({
      ...activeSession(),
      revokedAt: new Date(),
    });
    await expect(
      service.rotate(refreshToken('token-1')),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    sessionRepository.findOneBy.mockResolvedValueOnce({
      ...activeSession(),
      expiresAt: new Date(Date.now() - 1),
    });
    await expect(
      service.rotate(refreshToken('token-1')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
