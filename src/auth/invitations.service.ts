import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthTokenPurpose } from '../common/enums/index.js';
import type { Environment } from '../config/environment.js';
import { MailService } from '../mail/mail.service.js';
import type { Account } from './accounts.service.js';
import { OneTimeTokensService } from './one-time-tokens.service.js';

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

export type InvitedAccount = Pick<Account, 'id' | 'role' | 'name' | 'email'>;

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);
  private readonly staffInviteUrl: string;

  constructor(
    private readonly oneTimeTokens: OneTimeTokensService,
    private readonly mail: MailService,
    config: ConfigService<Environment, true>,
  ) {
    this.staffInviteUrl = config.get('STAFF_INVITE_URL', { infer: true });
  }

  async inviteStaffMember(staffMember: InvitedAccount) {
    const token = await this.oneTimeTokens.issue(
      staffMember,
      AuthTokenPurpose.INVITE,
      INVITE_TTL_MS,
    );
    const inviteUrl = new URL(this.staffInviteUrl);
    inviteUrl.searchParams.set('token', token);

    // The account already exists; a mail failure must not undo the signup.
    // "Forgot password" works for accounts without password, so it doubles
    // as a way to resend access.
    await this.mail
      .sendInvite({
        to: staffMember.email,
        name: staffMember.name,
        inviteUrl: inviteUrl.toString(),
      })
      .catch((error: unknown) => {
        this.logger.error(`Invite e-mail to ${staffMember.id} failed`, error);
      });
  }
}
