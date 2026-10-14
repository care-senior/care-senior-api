import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { InvitationsService } from '../../auth/services/invitations.service.js';
import { SessionsService } from '../../auth/services/sessions.service.js';
import { paginate } from '../../../common/dto/paginated-response.dto.js';
import { StaffRole, UserRole } from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { isUniqueViolation } from '../../../common/utils/database-errors.js';
import { containsPattern } from '../../../common/utils/like-pattern.js';
import type { CreateStaffDto } from '../dto/create-staff.dto.js';
import type { QueryStaffDto } from '../dto/query-staff.dto.js';
import { StaffPageDto, StaffResponseDto } from '../dto/staff-response.dto.js';
import type { UpdateOwnProfileDto } from '../dto/update-own-profile.dto.js';
import type { UpdateStaffDto } from '../dto/update-staff.dto.js';
import { StaffMember } from '../entities/staff-member.entity.js';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(StaffMember)
    private readonly staffRepository: Repository<StaffMember>,
    private readonly invitations: InvitationsService,
    private readonly sessions: SessionsService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    query: QueryStaffDto,
    currentUser: AuthenticatedUser,
  ): Promise<StaffPageDto> {
    const clinicId = this.ownClinicId(currentUser);
    if (query.clinicId && query.clinicId !== clinicId) {
      throw new ForbiddenException('Staff can only list their own clinic');
    }

    const queryBuilder = this.staffRepository
      .createQueryBuilder('staff')
      .where('staff.clinicId = :clinicId', { clinicId })
      .orderBy('staff.name', 'ASC')
      .addOrderBy('staff.id', 'ASC');

    if (!query.includeInactive) {
      queryBuilder.andWhere('staff.deactivatedAt IS NULL');
    }
    if (query.search) {
      queryBuilder.andWhere(
        '(staff.name ILIKE :search OR staff.email ILIKE :search)',
        { search: containsPattern(query.search) },
      );
    }
    if (query.staffRole) {
      queryBuilder.andWhere('staff.staffRole = :staffRole', {
        staffRole: query.staffRole,
      });
    }

    const result = await paginate(queryBuilder, query);
    return {
      ...result,
      data: result.data.map((staffMember) =>
        StaffResponseDto.fromEntity(staffMember),
      ),
    };
  }

  async findOne(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<StaffResponseDto> {
    return StaffResponseDto.fromEntity(
      await this.findInOwnClinicOrThrow(id, currentUser),
    );
  }

  async findMe(currentUser: AuthenticatedUser): Promise<StaffResponseDto> {
    return StaffResponseDto.fromEntity(await this.findMeOrThrow(currentUser));
  }

  async create(
    dto: CreateStaffDto,
    currentUser: AuthenticatedUser,
  ): Promise<StaffResponseDto> {
    const clinicId = this.ownClinicId(currentUser);
    this.assertCanManage(currentUser, dto.staffRole);

    const staffMember = await this.saveCheckingEmail(() =>
      this.staffRepository.save(
        this.staffRepository.create({ ...dto, clinicId }),
      ),
    );
    await this.invitations.inviteStaffMember(staffMember);
    return StaffResponseDto.fromEntity(staffMember);
  }

  async update(
    id: string,
    dto: UpdateStaffDto,
    currentUser: AuthenticatedUser,
  ): Promise<StaffResponseDto> {
    const staffMember = await this.findInOwnClinicOrThrow(id, currentUser);
    this.assertCanManage(currentUser, staffMember.staffRole, dto.staffRole);

    const losesCoordinatorRole =
      staffMember.staffRole === StaffRole.COORDINATOR &&
      dto.staffRole !== undefined &&
      dto.staffRole !== StaffRole.COORDINATOR;
    if (losesCoordinatorRole) {
      await this.assertAnotherActiveCoordinator(staffMember);
    }

    // A typo in the e-mail of someone not activated yet can be fixed; the
    // invite then goes to the new address only.
    const changesEmail =
      dto.email !== undefined && dto.email !== staffMember.email;
    const saved = await this.saveCheckingEmail(() =>
      this.dataSource.transaction(async (manager) => {
        if (changesEmail) {
          await this.invitations.prepareEmailChange(manager, {
            id: staffMember.id,
            role: UserRole.STAFF,
          });
        }
        return manager.save(this.staffRepository.merge(staffMember, dto));
      }),
    );
    if (changesEmail) await this.invitations.inviteStaffMember(saved);
    return StaffResponseDto.fromEntity(saved);
  }

  async updateMe(
    dto: UpdateOwnProfileDto,
    currentUser: AuthenticatedUser,
  ): Promise<StaffResponseDto> {
    const staffMember = await this.findMeOrThrow(currentUser);
    const saved = await this.staffRepository.save(
      this.staffRepository.merge(staffMember, dto),
    );
    return StaffResponseDto.fromEntity(saved);
  }

  async deactivate(id: string, currentUser: AuthenticatedUser): Promise<void> {
    if (id === currentUser.id) {
      throw new ConflictException('Staff members cannot deactivate themselves');
    }
    const staffMember = await this.findInOwnClinicOrThrow(id, currentUser);
    this.assertCanManage(currentUser, staffMember.staffRole);
    if (staffMember.deactivatedAt) return;

    if (staffMember.staffRole === StaffRole.COORDINATOR) {
      await this.assertAnotherActiveCoordinator(staffMember);
    }
    staffMember.deactivatedAt = new Date();
    await this.staffRepository.save(staffMember);
    await this.sessions.revokeAllForUser(staffMember.id, UserRole.STAFF);
  }

  private ownClinicId(currentUser: AuthenticatedUser): string {
    if (currentUser.role !== UserRole.STAFF || !currentUser.clinicId) {
      throw new ForbiddenException('Only staff members can access staff data');
    }
    return currentUser.clinicId;
  }

  private async findMeOrThrow(
    currentUser: AuthenticatedUser,
  ): Promise<StaffMember> {
    this.ownClinicId(currentUser);
    const staffMember = await this.staffRepository.findOne({
      where: { id: currentUser.id },
    });
    if (!staffMember) {
      throw new NotFoundException(`Staff member ${currentUser.id} not found`);
    }
    return staffMember;
  }

  private async findInOwnClinicOrThrow(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<StaffMember> {
    const clinicId = this.ownClinicId(currentUser);
    const staffMember = await this.staffRepository.findOne({ where: { id } });
    if (!staffMember) {
      throw new NotFoundException(`Staff member ${id} not found`);
    }
    if (staffMember.clinicId !== clinicId) {
      throw new ForbiddenException('Staff member belongs to another clinic');
    }
    return staffMember;
  }

  // Only a coordinator may create, edit, promote to or deactivate a
  // coordinator, so a nurse can't grant herself full control of the clinic.
  private assertCanManage(
    currentUser: AuthenticatedUser,
    ...affectedRoles: (StaffRole | undefined)[]
  ) {
    const touchesCoordinator = affectedRoles.includes(StaffRole.COORDINATOR);
    if (touchesCoordinator && currentUser.staffRole !== StaffRole.COORDINATOR) {
      throw new ForbiddenException('Only coordinators can manage coordinators');
    }
  }

  private async assertAnotherActiveCoordinator(staffMember: StaffMember) {
    if (staffMember.deactivatedAt) return;
    const otherActiveCoordinators = await this.staffRepository.count({
      where: {
        clinicId: staffMember.clinicId,
        staffRole: StaffRole.COORDINATOR,
        deactivatedAt: IsNull(),
        id: Not(staffMember.id),
      },
    });
    if (otherActiveCoordinators === 0) {
      throw new ConflictException(
        'A clinic must keep at least one active coordinator',
      );
    }
  }

  private async saveCheckingEmail(
    save: () => Promise<StaffMember>,
  ): Promise<StaffMember> {
    try {
      return await save();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('E-mail already registered');
      }
      throw error;
    }
  }
}
