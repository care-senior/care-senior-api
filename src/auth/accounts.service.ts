import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import { StaffRole, UserRole } from '../common/enums/index.js';
import { Guardian } from '../guardians/entities/guardian.entity.js';
import { StaffMember } from '../staff/entities/staff-member.entity.js';

export interface Account {
  id: string;
  role: UserRole;
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
    role: UserRole,
    email: string,
  ): Promise<AccountWithPassword | null> {
    const entity = await this.accountQuery(role)
      .addSelect('account.password')
      .where('LOWER(account.email) = LOWER(:email)', { email })
      .getOne();
    if (!entity) return null;
    return {
      ...this.toAccount(role, entity),
      passwordHash: entity.password ?? null,
    };
  }

  async findById(role: UserRole, id: string): Promise<Account | null> {
    const entity = await this.accountQuery(role)
      .where('account.id = :id', { id })
      .getOne();
    return entity ? this.toAccount(role, entity) : null;
  }

  async updatePassword(role: UserRole, id: string, passwordHash: string) {
    await this.repositoryFor(role).update(id, { password: passwordHash });
  }

  private accountQuery(role: UserRole): SelectQueryBuilder<AccountEntity> {
    const columns =
      role === UserRole.STAFF
        ? ['id', 'name', 'email', 'photoPath', 'role', 'clinicId']
        : ['id', 'name', 'email', 'photoPath'];
    return (this.repositoryFor(role) as Repository<AccountEntity>)
      .createQueryBuilder('account')
      .select(columns.map((column) => `account.${column}`));
  }

  private repositoryFor(role: UserRole) {
    return role === UserRole.STAFF ? this.staffMembers : this.guardians;
  }

  private toAccount(role: UserRole, entity: AccountEntity): Account {
    const account: Account = {
      id: entity.id,
      role,
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
