import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import { StaffRole, UserRole } from '../common/enums/index.js';
import { Guardian } from '../guardians/entities/guardian.entity.js';
import { StaffMember } from '../staff/entities/staff-member.entity.js';

export interface Account {
  id: string;
  userRole: UserRole;
  name: string;
  email: string;
  photoPath?: string | null;
  staffRole?: StaffRole;
  clinicId?: string;
}

export interface AccountWithPassword extends Account {
  passwordHash: string | null;
}

type AccountEntity = StaffMember | Guardian;

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(StaffMember)
    private readonly staffMembers: Repository<StaffMember>,
    @InjectRepository(Guardian)
    private readonly guardians: Repository<Guardian>,
  ) {}

  async findByEmailWithPassword(
    userRole: UserRole,
    email: string,
  ): Promise<AccountWithPassword | null> {
    const entity = await this.accountQuery(userRole)
      .addSelect('account.password')
      .where('LOWER(account.email) = LOWER(:email)', { email })
      .getOne();
    if (!entity) return null;
    return {
      ...this.toAccount(userRole, entity),
      passwordHash: entity.password ?? null,
    };
  }

  async findById(userRole: UserRole, id: string): Promise<Account | null> {
    const entity = await this.accountQuery(userRole)
      .where('account.id = :id', { id })
      .getOne();
    return entity ? this.toAccount(userRole, entity) : null;
  }

  async updatePassword(userRole: UserRole, id: string, passwordHash: string) {
    await this.repositoryFor(userRole).update(id, { password: passwordHash });
  }

  private accountQuery(userRole: UserRole): SelectQueryBuilder<AccountEntity> {
    const columns =
      userRole === UserRole.STAFF
        ? ['id', 'name', 'email', 'photoPath', 'role', 'clinicId']
        : ['id', 'name', 'email', 'photoPath'];
    return (this.repositoryFor(userRole) as Repository<AccountEntity>)
      .createQueryBuilder('account')
      .select(columns.map((column) => `account.${column}`));
  }

  private repositoryFor(userRole: UserRole) {
    return userRole === UserRole.STAFF ? this.staffMembers : this.guardians;
  }

  private toAccount(userRole: UserRole, entity: AccountEntity): Account {
    const account: Account = {
      id: entity.id,
      userRole,
      name: entity.name,
      email: entity.email,
      photoPath: entity.photoPath ?? null,
    };
    if (entity instanceof StaffMember) {
      account.staffRole = entity.role;
      account.clinicId = entity.clinicId;
    }
    return account;
  }
}
