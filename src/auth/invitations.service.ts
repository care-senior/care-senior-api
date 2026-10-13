import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthTokenPurpose, UserRole } from '../common/enums/index.js';
import type { Environment } from '../config/environment.js';
import { MailService } from '../mail/mail.service.js';
import type { Account } from './accounts.service.js';
import { OneTimeTokensService } from './one-time-tokens.service.js';

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

export type InvitedAccount = Pick<Account, 'id' | 'name' | 'email'>;

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);
  private readonly inviteUrls: Record<UserRole, string>;

  constructor(
    private readonly oneTimeTokens: OneTimeTokensService,
    private readonly mail: MailService,
    config: ConfigService<Environment, true>,
  ) {
    this.inviteUrls = {
      [UserRole.STAFF]: config.get('STAFF_INVITE_URL', { infer: true }),
      [UserRole.GUARDIAN]: config.get('GUARDIAN_INVITE_URL', { infer: true }),
    };
  }

  inviteStaffMember(staffMember: InvitedAccount) {
    return this.invite({ ...staffMember, role: UserRole.STAFF });
  }

  inviteGuardian(guardian: InvitedAccount) {
    return this.invite({ ...guardian, role: UserRole.GUARDIAN });
  }

  private async invite(account: InvitedAccount & { role: UserRole }) {
    const token = await this.oneTimeTokens.issue(
      account,
      AuthTokenPurpose.INVITE,
      INVITE_TTL_MS,
    );
    const inviteUrl = new URL(this.inviteUrls[account.role]);
    inviteUrl.searchParams.set('token', token);

    // The account already exists; a mail failure must not undo the signup.
    // "Forgot password" works for accounts without password, so it doubles
    // as a way to resend access.
    await this.mail
      .sendInvite({
        to: account.email,
        name: account.name,
        inviteUrl: inviteUrl.toString(),
        role: account.role,
      })
      .catch((error: unknown) => {
        this.logger.error(`Invite e-mail to ${account.id} failed`, error);
      });
  }
}
