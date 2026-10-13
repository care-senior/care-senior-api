import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { DataSource, type EntityManager, Repository } from 'typeorm';
import { InvitationsService } from '../auth/invitations.service.js';
import { Clinic } from '../clinics/entities/clinic.entity.js';
import { paginate } from '../common/dto/paginated-response.dto.js';
import { UserRole } from '../common/enums/index.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface.js';
import { isUniqueViolation } from '../common/utils/database-errors.js';
import { ResidentResponseDto } from '../residents/dto/resident-response.dto.js';
import { Resident } from '../residents/entities/resident.entity.js';
import { Room } from '../rooms/entities/room.entity.js';
import type { ContactClinicQueryDto } from './dto/contact-clinic-query.dto.js';
import type { CreateGuardianDto } from './dto/create-guardian.dto.js';
import { GuardianResponseDto } from './dto/guardian-response.dto.js';
import type { PendingLinkRequestPageDto } from './dto/pending-link-request.dto.js';
import type { QueryPendingLinkRequestsDto } from './dto/query-pending-link-requests.dto.js';
import type { UpdateGuardianDto } from './dto/update-guardian.dto.js';
import type { UpdateOwnGuardianProfileDto } from './dto/update-own-guardian-profile.dto.js';
import type { WalkInResponseDto } from './dto/walk-in-response.dto.js';
import { Guardian } from './entities/guardian.entity.js';

@Injectable()
export class GuardiansService {
  constructor(
    @InjectRepository(Guardian)
    private readonly guardianRepository: Repository<Guardian>,
    @InjectRepository(Resident)
    private readonly residentRepository: Repository<Resident>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    private readonly dataSource: DataSource,
    private readonly invitations: InvitationsService,
  ) {}

  async create(
    dto: CreateGuardianDto,
    currentUser: AuthenticatedUser,
  ): Promise<WalkInResponseDto> {
    const clinicId = this.ownClinicId(currentUser);
    const { guardian, resident } = await this.createWithResident(dto, clinicId);
    await this.invitations.inviteGuardian(guardian);
    return {
      guardian: GuardianResponseDto.fromEntity(guardian, currentUser),
      resident: this.toResidentResponse(resident),
    };
  }

  async findOne(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<GuardianResponseDto> {
    const guardian = await this.findOrThrow(id);
    await this.assertCanAccess(guardian, currentUser);
    return GuardianResponseDto.fromEntity(guardian, currentUser);
  }

  async updateMe(
    dto: UpdateOwnGuardianProfileDto,
    currentUser: AuthenticatedUser,
  ): Promise<GuardianResponseDto> {
    if (currentUser.role !== UserRole.GUARDIAN) {
      throw new ForbiddenException('Only guardians have a guardian profile');
    }
    const guardian = await this.findOrThrow(currentUser.id);
    const saved = await this.guardianRepository.save(
      this.guardianRepository.merge(guardian, dto),
    );
    return GuardianResponseDto.fromEntity(saved, currentUser);
  }

  async update(
    id: string,
    dto: UpdateGuardianDto,
    currentUser: AuthenticatedUser,
  ): Promise<GuardianResponseDto> {
    this.ownClinicId(currentUser);
    const guardian = await this.findOrThrow(id);
    await this.assertCanAccess(guardian, currentUser);
    try {
      const saved = await this.guardianRepository.save(
        this.guardianRepository.merge(guardian, dto),
      );
      return GuardianResponseDto.fromEntity(saved, currentUser);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('E-mail already registered');
      }
      throw error;
    }
  }

  async contactClinic(
    id: string,
    { clinicId }: ContactClinicQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<GuardianResponseDto> {
    if (currentUser.role !== UserRole.GUARDIAN || currentUser.id !== id) {
      throw new ForbiddenException(
        'Guardians can only register their own clinic contacts',
      );
    }
    const clinicExists = await this.clinicRepository.existsBy({ id: clinicId });
    if (!clinicExists) {
      throw new NotFoundException(`Clinic ${clinicId} not found`);
    }

    await this.guardianRepository
      .createQueryBuilder()
      .update()
      .set({
        contactedClinicIds: () =>
          'array_append(contacted_clinic_ids, :clinicId)',
      })
      .where('id = :id', { id })
      .andWhere('NOT (:clinicId = ANY(contacted_clinic_ids))')
      .setParameters({ clinicId })
      .execute();

    return GuardianResponseDto.fromEntity(
      await this.findOrThrow(id),
      currentUser,
    );
  }

  async findPendingLinkRequests(
    query: QueryPendingLinkRequestsDto,
    currentUser: AuthenticatedUser,
  ): Promise<PendingLinkRequestPageDto> {
    const clinicId = this.ownClinicId(currentUser);
    if (query.clinicId && query.clinicId !== clinicId) {
      throw new ForbiddenException(
        'Staff can only see link requests of their own clinic',
      );
    }

    const guardiansPage = await paginate(
      this.guardianRepository
        .createQueryBuilder('guardian')
        .where(':clinicId = ANY(guardian.contactedClinicIds)', { clinicId })
        .andWhere(
          `EXISTS (
            SELECT 1 FROM guardian_resident link
            JOIN residents unlinked ON unlinked.id = link.resident_id
            WHERE link.guardian_id = guardian.id AND unlinked.clinic_id IS NULL
          )`,
        )
        .orderBy('guardian.name', 'ASC')
        .addOrderBy('guardian.id', 'ASC'),
      query,
    );

    const unlinkedResidents = await this.findUnlinkedResidentsOf(
      guardiansPage.data.map(({ id }) => id),
    );
    return {
      ...guardiansPage,
      data: guardiansPage.data.map((guardian) => ({
        guardian: GuardianResponseDto.fromEntity(guardian, currentUser),
        residents: unlinkedResidents
          .filter((resident) =>
            resident.guardians.some(({ id }) => id === guardian.id),
          )
          .map((resident) => this.toResidentResponse(resident)),
      })),
    };
  }

  private async createWithResident(dto: CreateGuardianDto, clinicId: string) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        await this.assertRoomHasFreeBed(manager, dto.resident.roomId, clinicId);
        const resident = await manager.save(
          manager.create(Resident, { ...dto.resident, clinicId }),
        );
        const guardian = await manager.save(
          manager.create(Guardian, {
            ...dto.guardian,
            contactedClinicIds: [],
            residents: [resident],
          }),
        );
        return { guardian, resident };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('E-mail already registered');
      }
      throw error;
    }
  }

  // The room row stays locked until the transaction ends, so two concurrent
  // walk-ins can't both take the last free bed.
  private async assertRoomHasFreeBed(
    manager: EntityManager,
    roomId: string,
    clinicId: string,
  ) {
    const room = await manager
      .getRepository(Room)
      .createQueryBuilder('room')
      .setLock('pessimistic_write')
      .where('room.id = :roomId', { roomId })
      .getOne();
    if (!room) {
      throw new NotFoundException(`Room ${roomId} not found`);
    }
    if (room.clinicId !== clinicId) {
      throw new ForbiddenException('Room belongs to another clinic');
    }
    const occupants = await manager.count(Resident, { where: { roomId } });
    if (occupants >= room.capacity) {
      throw new ConflictException(`Room ${room.number} is full`);
    }
  }

  private async findUnlinkedResidentsOf(
    guardianIds: string[],
  ): Promise<Resident[]> {
    if (guardianIds.length === 0) return [];
    return this.residentRepository
      .createQueryBuilder('resident')
      .innerJoin('resident.guardians', 'guardian')
      .addSelect('guardian.id')
      .where('guardian.id IN (:...guardianIds)', { guardianIds })
      .andWhere('resident.clinicId IS NULL')
      .orderBy('resident.name', 'ASC')
      .getMany();
  }

  private async findOrThrow(id: string): Promise<Guardian> {
    const guardian = await this.guardianRepository.findOne({ where: { id } });
    if (!guardian) {
      throw new NotFoundException(`Guardian ${id} not found`);
    }
    return guardian;
  }

  // A clinic only sees guardians it has a reason to know: one of their
  // residents lives there, or they contacted it while looking for a clinic.
  private async assertCanAccess(
    guardian: Guardian,
    currentUser: AuthenticatedUser,
  ) {
    if (currentUser.role === UserRole.GUARDIAN) {
      if (currentUser.id !== guardian.id) {
        throw new ForbiddenException(
          'Guardians can only access their own profile',
        );
      }
      return;
    }

    const clinicId = this.ownClinicId(currentUser);
    const isRelated =
      guardian.contactedClinicIds.includes(clinicId) ||
      (await this.residentRepository
        .createQueryBuilder('resident')
        .innerJoin('resident.guardians', 'guardian', 'guardian.id = :id', {
          id: guardian.id,
        })
        .where('resident.clinicId = :clinicId', { clinicId })
        .getExists());
    if (!isRelated) {
      throw new ForbiddenException('Guardian is not related to your clinic');
    }
  }

  private ownClinicId(currentUser: AuthenticatedUser): string {
    if (currentUser.role !== UserRole.STAFF || !currentUser.clinicId) {
      throw new ForbiddenException('Only staff members can do this');
    }
    return currentUser.clinicId;
  }

  private toResidentResponse(resident: Resident): ResidentResponseDto {
    return plainToInstance(ResidentResponseDto, resident, {
      excludeExtraneousValues: true,
    });
  }
}
