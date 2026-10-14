import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, IsNull, type Repository } from 'typeorm';
import type {
  AuthTokenPurpose,
  UserRole,
} from '../../../common/enums/index.js';
import type { Account } from './accounts.service.js';
import { AuthToken } from '../entities/auth-token.entity.js';

export interface TokenOwner {
  userId: string;
  userRole: UserRole;
}

const TOKEN_BYTES = 32;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class OneTimeTokensService {
  constructor(
    @InjectRepository(AuthToken)
    private readonly tokens: Repository<AuthToken>,
  ) {}

  async issue(
    account: Pick<Account, 'id' | 'role'>,
    purpose: AuthTokenPurpose,
    ttlMs: number,
  ): Promise<string> {
    const now = new Date();
    await this.tokens.update(
      {
        userId: account.id,
        userRole: account.role,
        purpose,
        usedAt: IsNull(),
      },
      { usedAt: now },
    );

    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    await this.tokens.insert({
      userId: account.id,
      userRole: account.role,
      purpose,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + ttlMs),
    });
    return token;
  }

  async consume(
    token: string,
    purpose: AuthTokenPurpose,
    userRole?: UserRole,
    manager: EntityManager = this.tokens.manager,
  ): Promise<TokenOwner> {
    const query = manager
      .getRepository(AuthToken)
      .createQueryBuilder()
      .update()
      .set({ usedAt: () => 'now()' })
      .where('token_hash = :tokenHash', { tokenHash: hashToken(token) })
      .andWhere('purpose = :purpose', { purpose })
      .andWhere('used_at IS NULL')
      .andWhere('expires_at > now()')
      .returning(['userId', 'userRole']);
    if (userRole) query.andWhere('user_role = :userRole', { userRole });
    const result = await query.execute();

    const [owner] = result.raw as { user_id: string; user_role: UserRole }[];
    if (!owner) throw new BadRequestException('Invalid or expired token');
    return { userId: owner.user_id, userRole: owner.user_role };
  }

  async revokeAll(
    { id, role }: Pick<Account, 'id' | 'role'>,
    manager: EntityManager = this.tokens.manager,
  ) {
    await manager.update(
      AuthToken,
      { userId: id, userRole: role, usedAt: IsNull() },
      { usedAt: new Date() },
    );
  }
}
