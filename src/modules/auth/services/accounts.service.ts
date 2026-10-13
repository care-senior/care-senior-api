import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import { StaffRole, UserRole } from '../../../common/enums/index.js';
import { isUniqueViolation } from '../../../common/utils/database-errors.js';
import { Guardian } from '../../guardians/entities/guardian.entity.js';
import type { CreateResidentDto } from '../../residents/dto/create-resident.dto.js';
import { Resident } from '../../residents/entities/resident.entity.js';
import { StaffMember } from '../../staff/entities/staff-member.entity.js';

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
      .andWhere('LOWER(account.email) = LOWER(:email)', { email })
      .getOne();
    if (!entity) return null;
    return {
      ...this.toAccount(role, entity),
      passwordHash: entity.password ?? null,
    };
  }

  async findById(role: UserRole, id: string): Promise<Account | null> {
    const entity = await this.accountQuery(role)
      .andWhere('account.id = :id', { id })
      .getOne();
    return entity ? this.toAccount(role, entity) : null;
  }

  async createGuardianWithResident(
    guardian: Pick<Guardian, 'name' | 'email' | 'cpf' | 'password'>,
    resident: CreateResidentDto,
  ): Promise<Account> {
    try {
      const saved = await this.guardians.manager.transaction(
        async (manager) => {
          const savedResident = await manager.save(
            manager.create(Resident, resident),
          );
          return manager.save(
            manager.create(Guardian, {
              ...guardian,
              contactedClinicIds: [],
              residents: [savedResident],
            }),
          );
        },
      );
      return this.toAccount(UserRole.GUARDIAN, saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('E-mail already registered');
      }
      throw error;
    }
  }

  async updatePassword(role: UserRole, id: string, passwordHash: string) {
    await this.repositoryFor(role).update(id, { password: passwordHash });
  }

  private accountQuery(role: UserRole): SelectQueryBuilder<AccountEntity> {
    if (role === UserRole.STAFF) {
      return (this.staffMembers as Repository<AccountEntity>)
        .createQueryBuilder('account')
        .select(
          ['id', 'name', 'email', 'photoPath', 'staffRole', 'clinicId'].map(
            (column) => `account.${column}`,
          ),
        )
        .where('account.deactivatedAt IS NULL');
    }
    return (this.guardians as Repository<AccountEntity>)
      .createQueryBuilder('account')
      .select(
        ['id', 'name', 'email', 'photoPath'].map(
          (column) => `account.${column}`,
        ),
      );
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
      account.staffRole = entity.staffRole;
      account.clinicId = entity.clinicId;
    }
    return account;
  }
}
