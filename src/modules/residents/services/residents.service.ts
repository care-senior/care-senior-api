import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  type EntityManager,
  Repository,
  type SelectQueryBuilder,
} from 'typeorm';
import { InvitationsService } from '../../auth/services/invitations.service.js';
import { paginate } from '../../../common/dto/paginated-response.dto.js';
import type { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { NotificationType, UserRole } from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { isUniqueViolation } from '../../../common/utils/database-errors.js';
import { containsPattern } from '../../../common/utils/like-pattern.js';
import {
  GuardianPageDto,
  GuardianResponseDto,
} from '../../guardians/dto/guardian-response.dto.js';
import { Clinic } from '../../clinics/entities/clinic.entity.js';
import { Guardian } from '../../guardians/entities/guardian.entity.js';
import { NotifierService } from '../../notifications/services/notifier.service.js';
import { lockRoomWithFreeBed } from '../../rooms/utils/room-occupancy.js';
import type { AddGuardianDto } from '../dto/add-guardian.dto.js';
import type { AssignRoomDto } from '../dto/assign-room.dto.js';
import type { QueryResidentsDto } from '../dto/query-residents.dto.js';
import {
  ResidentPageDto,
  ResidentResponseDto,
} from '../dto/resident-response.dto.js';
import type { UpdateResidentDto } from '../dto/update-resident.dto.js';
import { Resident } from '../entities/resident.entity.js';
import { ResidentAccessService } from './resident-access.service.js';

@Injectable()
export class ResidentsService {
  constructor(
    @InjectRepository(Resident)
    private readonly residentRepository: Repository<Resident>,
    @InjectRepository(Guardian)
    private readonly guardianRepository: Repository<Guardian>,
    private readonly dataSource: DataSource,
    private readonly invitations: InvitationsService,
    private readonly residentAccess: ResidentAccessService,
    private readonly notifier: NotifierService,
  ) {}

  async findAll(
    query: QueryResidentsDto,
    currentUser: AuthenticatedUser,
  ): Promise<ResidentPageDto> {
    const queryBuilder = this.residentRepository
      .createQueryBuilder('resident')
      .leftJoinAndSelect('resident.room', 'room')
      .orderBy('resident.name', 'ASC')
      .addOrderBy('resident.id', 'ASC');

    if (currentUser.role === UserRole.GUARDIAN) {
      if (query.guardianId && query.guardianId !== currentUser.id) {
        throw new ForbiddenException(
          'Guardians can only list their own residents',
        );
      }
      this.whereHasGuardian(queryBuilder, currentUser.id);
      if (query.clinicId) {
        queryBuilder.andWhere('resident.clinicId = :clinicId', {
          clinicId: query.clinicId,
        });
      }
    } else {
      const clinicId = this.ownClinicId(currentUser);
      if (query.clinicId && query.clinicId !== clinicId) {
        throw new ForbiddenException(
          'Staff can only list residents of their own clinic',
        );
      }
      queryBuilder.andWhere('resident.clinicId = :clinicId', { clinicId });
      if (query.guardianId) {
        this.whereHasGuardian(queryBuilder, query.guardianId);
      }
    }

    if (query.search) {
      queryBuilder.andWhere('resident.name ILIKE :search', {
        search: containsPattern(query.search),
      });
    }

    const result = await paginate(queryBuilder, query);
    return {
      ...result,
      data: result.data.map((resident) =>
        ResidentResponseDto.fromEntity(resident),
      ),
    };
  }

  async findOne(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<ResidentResponseDto> {
    const resident = await this.findOrThrow(id);
    await this.residentAccess.assertCanView(resident, currentUser);
    return ResidentResponseDto.fromEntity(resident);
  }

  async update(
    id: string,
    dto: UpdateResidentDto,
    currentUser: AuthenticatedUser,
  ): Promise<ResidentResponseDto> {
    const resident = await this.findOrThrow(id);
    await this.residentAccess.assertCanEditProfile(resident, currentUser);
    const saved = await this.residentRepository.save(
      this.residentRepository.merge(resident, dto),
    );
    return ResidentResponseDto.fromEntity(saved);
  }

  async link(
    id: string,
    { roomId }: AssignRoomDto,
    currentUser: AuthenticatedUser,
  ): Promise<ResidentResponseDto> {
    const clinicId = this.ownClinicId(currentUser);
    await this.dataSource.transaction(async (manager) => {
      const resident = await this.lockResident(manager, id);
      if (
        !(await this.residentAccess.hasPendingLinkRequest(
          id,
          clinicId,
          manager,
        ))
      ) {
        throw new ForbiddenException(
          'Resident has no pending link request for your clinic',
        );
      }
      if (resident.clinicId) {
        throw new ConflictException(
          `Resident ${id} is already linked to a clinic`,
        );
      }
      await lockRoomWithFreeBed(manager, roomId, clinicId);
      await manager.update(Resident, id, { clinicId, roomId });
    });
    const linked = await this.findOrThrow(id);
    await this.notifier.notify(
      {
        type: NotificationType.GENERAL,
        title: 'Vínculo aceito',
        message: `${linked.name} agora está na ${await this.clinicName(clinicId)}, quarto ${linked.roomNumber}.`,
      },
      { guardiansOf: id },
    );
    return ResidentResponseDto.fromEntity(linked);
  }

  async discharge(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<ResidentResponseDto> {
    const resident = await this.findOrThrow(id);
    this.residentAccess.assertLinkedTo(resident, this.ownClinicId(currentUser));
    await this.residentRepository.update(id, { clinicId: null, roomId: null });
    await this.notifier.notify(
      {
        type: NotificationType.GENERAL,
        title: 'Alta registrada',
        message: `A ${await this.clinicName(resident.clinicId!)} registrou a alta de ${resident.name}.`,
      },
      { guardiansOf: id },
    );
    return ResidentResponseDto.fromEntity(await this.findOrThrow(id));
  }

  async changeRoom(
    id: string,
    { roomId }: AssignRoomDto,
    currentUser: AuthenticatedUser,
  ): Promise<ResidentResponseDto> {
    const clinicId = this.ownClinicId(currentUser);
    await this.dataSource.transaction(async (manager) => {
      const resident = await this.lockResident(manager, id);
      this.residentAccess.assertLinkedTo(resident, clinicId);
      if (resident.roomId === roomId) return;
      await lockRoomWithFreeBed(manager, roomId, clinicId);
      await manager.update(Resident, id, { roomId });
    });
    return ResidentResponseDto.fromEntity(await this.findOrThrow(id));
  }

  async findGuardians(
    id: string,
    query: PaginationQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<GuardianPageDto> {
    await this.residentAccess.assertCanView(
      await this.findOrThrow(id),
      currentUser,
    );
    const result = await paginate(
      this.guardianRepository
        .createQueryBuilder('guardian')
        .innerJoin('guardian.residents', 'resident', 'resident.id = :id', {
          id,
        })
        .orderBy('guardian.name', 'ASC')
        .addOrderBy('guardian.id', 'ASC'),
      query,
    );
    return {
      ...result,
      data: result.data.map((guardian) =>
        GuardianResponseDto.fromEntity(guardian, currentUser),
      ),
    };
  }

  async addGuardian(
    id: string,
    dto: AddGuardianDto,
    currentUser: AuthenticatedUser,
  ): Promise<GuardianResponseDto> {
    const resident = await this.findOrThrow(id);
    this.residentAccess.assertLinkedTo(resident, this.ownClinicId(currentUser));

    let guardian: Guardian;
    try {
      guardian = await this.guardianRepository.save(
        this.guardianRepository.create({
          ...dto,
          contactedClinicIds: [],
          residents: [resident],
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('E-mail already registered');
      }
      throw error;
    }
    await this.invitations.inviteGuardian(guardian);
    return GuardianResponseDto.fromEntity(guardian, currentUser);
  }

  async removeGuardian(
    id: string,
    guardianId: string,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    const clinicId = this.ownClinicId(currentUser);
    await this.dataSource.transaction(async (manager) => {
      const resident = await this.lockResident(manager, id);
      this.residentAccess.assertLinkedTo(resident, clinicId);
      const guardians = await manager
        .getRepository(Guardian)
        .createQueryBuilder('guardian')
        .select('guardian.id')
        .innerJoin('guardian.residents', 'resident', 'resident.id = :id', {
          id,
        })
        .getMany();
      if (!guardians.some((guardian) => guardian.id === guardianId)) {
        throw new NotFoundException(
          `Guardian ${guardianId} is not a guardian of resident ${id}`,
        );
      }
      if (guardians.length === 1) {
        throw new ConflictException(
          'A resident must keep at least one guardian',
        );
      }
      await manager
        .createQueryBuilder()
        .relation(Guardian, 'residents')
        .of(guardianId)
        .remove(id);
    });
  }

  private whereHasGuardian(
    queryBuilder: SelectQueryBuilder<Resident>,
    guardianId: string,
  ) {
    queryBuilder.andWhere(
      `EXISTS (
        SELECT 1 FROM guardian_resident link
        WHERE link.resident_id = resident.id AND link.guardian_id = :guardianId
      )`,
      { guardianId },
    );
  }

  private async clinicName(clinicId: string): Promise<string> {
    const clinic = await this.dataSource.manager.findOneBy(Clinic, {
      id: clinicId,
    });
    return clinic?.name ?? 'clínica';
  }

  private async findOrThrow(id: string): Promise<Resident> {
    const resident = await this.residentRepository.findOne({
      where: { id },
      relations: { room: true },
    });
    if (!resident) {
      throw new NotFoundException(`Resident ${id} not found`);
    }
    return resident;
  }

  // Locks the resident row so concurrent changes to the same resident (link,
  // change of room, guardian removal) run one after the other.
  private async lockResident(
    manager: EntityManager,
    id: string,
  ): Promise<Resident> {
    const resident = await manager
      .getRepository(Resident)
      .createQueryBuilder('resident')
      .setLock('pessimistic_write')
      .where('resident.id = :id', { id })
      .getOne();
    if (!resident) {
      throw new NotFoundException(`Resident ${id} not found`);
    }
    return resident;
  }

  private ownClinicId(currentUser: AuthenticatedUser): string {
    if (currentUser.role !== UserRole.STAFF || !currentUser.clinicId) {
      throw new ForbiddenException('Only staff members can do this');
    }
    return currentUser.clinicId;
  }
}
