import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthTokenPurpose, UserRole } from '../common/enums/index.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface.js';
import type { Environment } from '../config/environment.js';
import { MailService } from '../mail/mail.service.js';
import { AccountsService, type Account } from './accounts.service.js';
import type { AcceptInviteDto } from './dto/accept-invite.dto.js';
import type { AuthResponseDto } from './dto/auth-response.dto.js';
import { AuthUserDto } from './dto/auth-user.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';
import type { AuthSession } from './entities/auth-session.entity.js';
import { JwtTokensService } from './jwt-tokens.service.js';
import { OneTimeTokensService } from './one-time-tokens.service.js';
import { PasswordService } from './password.service.js';
import { SessionsService } from './sessions.service.js';

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export type AuthResult = Required<AuthResponseDto>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly passwordResetUrl: string;

  constructor(
    private readonly accounts: AccountsService,
    private readonly passwords: PasswordService,
    private readonly jwtTokens: JwtTokensService,
    private readonly sessions: SessionsService,
    private readonly oneTimeTokens: OneTimeTokensService,
    private readonly mail: MailService,
    config: ConfigService<Environment, true>,
  ) {
    this.passwordResetUrl = config.get('PASSWORD_RESET_URL', { infer: true });
  }

  async login(
    role: UserRole,
    { email, password }: LoginDto,
  ): Promise<AuthResult> {
    const account = await this.accounts.findByEmailWithPassword(role, email);
    const isValid = await this.passwords.verify(
      account?.passwordHash,
      password,
    );
    if (!account || !isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { passwordHash: _, ...accountWithoutPassword } = account;
    const session = await this.sessions.start(
      accountWithoutPassword,
      this.jwtTokens.refreshTokenTtlMs,
    );
    return this.buildAuthResult(accountWithoutPassword, session);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const payload = await this.jwtTokens.verifyRefreshToken(refreshToken);
    const session = await this.sessions.rotate(payload);
    const account = await this.accounts.findById(
      session.userRole,
      session.userId,
    );
    if (!account) {
      await this.sessions.revoke(session.id);
      throw new UnauthorizedException('Session expired');
    }
    return this.buildAuthResult(account, session);
  }

  async logout(refreshToken: string) {
    const payload = await this.jwtTokens
      .verifyRefreshToken(refreshToken)
      .catch(() => null);
    if (payload) await this.sessions.revoke(payload.sid);
  }

  async me(currentUser: AuthenticatedUser): Promise<AuthUserDto> {
    const account = await this.accounts.findById(
      currentUser.role,
      currentUser.id,
    );
    if (!account) throw new UnauthorizedException('Session expired');
    return AuthUserDto.fromAccount(account);
  }

  async requestPasswordReset(role: UserRole, email: string) {
    const account = await this.accounts.findByEmailWithPassword(role, email);
    if (!account) return;

    const token = await this.oneTimeTokens.issue(
      account,
      AuthTokenPurpose.PASSWORD_RESET,
      PASSWORD_RESET_TTL_MS,
    );
    const resetUrl = new URL(this.passwordResetUrl);
    resetUrl.searchParams.set('token', token);

    // The response must not depend on whether the e-mail exists, so a mail
    // failure is logged instead of surfacing as an error to the caller.
    await this.mail
      .sendPasswordReset({
        to: account.email,
        name: account.name,
        resetUrl: resetUrl.toString(),
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Password reset e-mail to ${account.id} failed`,
          error,
        );
      });
  }

  async resetPassword({ token, password }: ResetPasswordDto) {
    const owner = await this.oneTimeTokens.consume(
      token,
      AuthTokenPurpose.PASSWORD_RESET,
    );
    await this.accounts.updatePassword(
      owner.userRole,
      owner.userId,
      await this.passwords.hash(password),
    );
    await this.sessions.revokeAllForUser(owner.userId, owner.userRole);
  }

  async acceptInvite(role: UserRole, { token, password }: AcceptInviteDto) {
    const owner = await this.oneTimeTokens.consume(
      token,
      AuthTokenPurpose.INVITE,
      role,
    );
    const account = await this.accounts.findById(role, owner.userId);
    if (!account) throw new BadRequestException('Invalid or expired token');

    await this.accounts.updatePassword(
      role,
      account.id,
      await this.passwords.hash(password),
    );
  }

  private async buildAuthResult(
    account: Account,
    session: AuthSession,
  ): Promise<AuthResult> {
    const [{ accessToken, expiresIn }, refreshToken] = await Promise.all([
      this.jwtTokens.signAccessToken(account),
      this.jwtTokens.signRefreshToken(session),
    ]);
    return {
      accessToken,
      refreshToken,
      expiresIn,
      user: AuthUserDto.fromAccount(account),
    };
  }
}
