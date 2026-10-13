import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, type Repository } from 'typeorm';
import type { UserRole } from '../common/enums/index.js';
import type { Account } from './accounts.service.js';
import { AuthSession } from './entities/auth-session.entity.js';
import type { RefreshTokenPayload } from './jwt-tokens.service.js';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(AuthSession)
    private readonly sessions: Repository<AuthSession>,
  ) {}

  start(account: Account, ttlMs: number): Promise<AuthSession> {
    const now = new Date();
    return this.sessions.save(
      this.sessions.create({
        userId: account.id,
        userRole: account.role,
        refreshTokenId: randomUUID(),
        expiresAt: new Date(now.getTime() + ttlMs),
        lastUsedAt: now,
      }),
    );
  }

  async rotate(refreshToken: RefreshTokenPayload): Promise<AuthSession> {
    const session = await this.sessions.findOneBy({ id: refreshToken.sid });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session expired');
    }
    // A refresh token that was already rotated is being replayed: someone else
    // may hold a copy, so the whole session is ended, not just this request.
    if (session.refreshTokenId !== refreshToken.jti) {
      await this.revoke(session.id);
      throw new UnauthorizedException('Session expired');
    }

    session.refreshTokenId = randomUUID();
    session.lastUsedAt = new Date();
    return this.sessions.save(session);
  }

  async revoke(sessionId: string) {
    await this.sessions.update(
      { id: sessionId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async revokeAllForUser(userId: string, userRole: UserRole) {
    await this.sessions.update(
      { userId, userRole, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
