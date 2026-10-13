import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StaffRole, UserRole } from '../common/enums/index.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface.js';
import { parseDurationToMs } from '../common/utils/duration.js';
import type { Environment } from '../config/environment.js';
import type { Account } from './accounts.service.js';
import type { AuthSession } from './entities/auth-session.entity.js';

interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  staffRole?: StaffRole;
  clinicId?: string;
}

export interface RefreshTokenPayload {
  sub: string;
  role: UserRole;
  sid: string;
  jti: string;
}

export interface SignedAccessToken {
  accessToken: string;
  expiresIn: number;
}

@Injectable()
export class JwtTokensService {
  readonly refreshTokenTtlMs: number;
  private readonly accessTokenTtlSeconds: number;
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<Environment, true>,
  ) {
    this.accessSecret = config.get('JWT_SECRET', { infer: true });
    this.refreshSecret = config.get('JWT_REFRESH_SECRET', { infer: true });
    this.accessTokenTtlSeconds =
      parseDurationToMs(config.get('JWT_ACCESS_TTL', { infer: true })) / 1000;
    this.refreshTokenTtlMs = parseDurationToMs(
      config.get('JWT_REFRESH_TTL', { infer: true }),
    );
  }

  async signAccessToken(account: Account): Promise<SignedAccessToken> {
    const payload: AccessTokenPayload = {
      sub: account.id,
      role: account.role,
      staffRole: account.staffRole,
      clinicId: account.clinicId,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTokenTtlSeconds,
    });
    return { accessToken, expiresIn: this.accessTokenTtlSeconds };
  }

  signRefreshToken(session: AuthSession): Promise<string> {
    const payload: RefreshTokenPayload = {
      sub: session.userId,
      role: session.userRole,
      sid: session.id,
      jti: session.refreshTokenId,
    };
    return this.jwt.signAsync(payload, {
      secret: this.refreshSecret,
      expiresIn: Math.floor(this.refreshTokenTtlMs / 1000),
    });
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    const payload = await this.verify<AccessTokenPayload>(
      token,
      this.accessSecret,
    );
    return {
      id: payload.sub,
      role: payload.role,
      staffRole: payload.staffRole,
      clinicId: payload.clinicId,
    };
  }

  verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    return this.verify<RefreshTokenPayload>(token, this.refreshSecret);
  }

  private async verify<T extends object>(
    token: string,
    secret: string,
  ): Promise<T> {
    try {
      return await this.jwt.verifyAsync<T>(token, { secret });
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }
}
