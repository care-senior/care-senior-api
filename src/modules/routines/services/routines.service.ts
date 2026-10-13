import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, type EntityManager, Repository } from 'typeorm';
import { paginate } from '../../../common/dto/paginated-response.dto.js';
import { RoutineScope, UserRole } from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { containsPattern } from '../../../common/utils/like-pattern.js';
import { Resident } from '../../residents/entities/resident.entity.js';
import { Room } from '../../rooms/entities/room.entity.js';
import type { CreateRoutineDto } from '../dto/create-routine.dto.js';
import type { QueryRoutinesDto } from '../dto/query-routines.dto.js';
import {
  RoutinePageDto,
  RoutineResponseDto,
} from '../dto/routine-response.dto.js';
import type { UpdateRoutineDto } from '../dto/update-routine.dto.js';
import { Routine } from '../entities/routine.entity.js';
import {
  lockRoutine,
  RoutineActivitiesService,
} from './routine-activities.service.js';

interface Coverage {
  scope: RoutineScope;
  residentIds?: string[];
  roomIds?: string[];
}

@Injectable()
export class RoutinesService {
  constructor(
    @InjectRepository(Routine)
    private readonly routineRepository: Repository<Routine>,
    private readonly dataSource: DataSource,
    private readonly routineActivities: RoutineActivitiesService,
  ) {}

  async findAll(
    query: QueryRoutinesDto,
    currentUser: AuthenticatedUser,
  ): Promise<RoutinePageDto> {
    const clinicId = this.ownClinicId(currentUser);
    if (query.clinicId && query.clinicId !== clinicId) {
      throw new ForbiddenException(
        'Staff can only list the routines of their own clinic',
      );
    }
    const queryBuilder = this.routineRepository
      .createQueryBuilder('routine')
      .leftJoin('routine.residents', 'resident')
      .addSelect(['resident.id', 'resident.name'])
      .leftJoin('routine.rooms', 'room')
      .addSelect(['room.id', 'room.number'])
      .where('routine.clinicId = :clinicId', { clinicId })
      .orderBy('routine.time', 'ASC')
      .addOrderBy('routine.title', 'ASC')
      .addOrderBy('routine.id', 'ASC');
    if (query.active !== undefined) {
      queryBuilder.andWhere('routine.active = :active', {
        active: query.active,
      });
    }
    if (query.search) {
      queryBuilder.andWhere('routine.title ILIKE :search', {
        search: containsPattern(query.search),
      });
    }

    const result = await paginate(queryBuilder, query);
    return {
      ...result,
      data: result.data.map((routine) =>
        RoutineResponseDto.fromEntity(routine),
      ),
    };
  }

  async findOne(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<RoutineResponseDto> {
    const routine = await this.findOrThrow(this.dataSource.manager, id);
    this.assertOwnClinic(routine, currentUser);
    return RoutineResponseDto.fromEntity(routine);
  }

  async create(
    { residentIds, roomIds, ...fields }: CreateRoutineDto,
    currentUser: AuthenticatedUser,
  ): Promise<RoutineResponseDto> {
    const clinicId = this.ownClinicId(currentUser);
    const id = await this.dataSource.transaction(async (manager) => {
      const routine = manager.create(Routine, { ...fields, clinicId });
      await this.applyCoverage(
        manager,
        routine,
        { scope: fields.scope, residentIds, roomIds },
        clinicId,
      );
      const saved = await manager.save(routine);
      await this.routineActivities.rebuild(manager, saved, new Date());
      return saved.id;
    });
    return this.findOne(id, currentUser);
  }

  async update(
    id: string,
    { residentIds, roomIds, scope, ...fields }: UpdateRoutineDto,
    currentUser: AuthenticatedUser,
  ): Promise<RoutineResponseDto> {
    await this.dataSource.transaction(async (manager) => {
      const routine = await this.lockOwnRoutine(manager, id, currentUser);
      manager.merge(Routine, routine, fields);
      if (scope !== undefined || residentIds || roomIds) {
        await this.applyCoverage(
          manager,
          routine,
          { scope: scope ?? routine.scope, residentIds, roomIds },
          routine.clinicId,
          scope === undefined || scope === routine.scope,
        );
      }
      const saved = await manager.save(routine);
      await this.routineActivities.rebuild(manager, saved, new Date());
    });
    return this.findOne(id, currentUser);
  }

  async toggle(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<RoutineResponseDto> {
    await this.dataSource.transaction(async (manager) => {
      const routine = await this.lockOwnRoutine(manager, id, currentUser);
      routine.active = !routine.active;
      await manager.update(Routine, id, { active: routine.active });
      await this.routineActivities.rebuild(manager, routine, new Date());
    });
    return this.findOne(id, currentUser);
  }

  /** Activities already done or started stay, without the routine. */
  async remove(id: string, currentUser: AuthenticatedUser): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.lockOwnRoutine(manager, id, currentUser);
      await this.routineActivities.removeManagedActivities(
        manager,
        id,
        new Date(),
      );
      await manager.delete(Routine, id);
    });
  }

  // `specificResidents` takes residents and `specificRoom` takes rooms, both
  // of the routine's clinic; `allResidents` takes neither. When the scope
  // stays the same on an update, an omitted list keeps the current one.
  private async applyCoverage(
    manager: EntityManager,
    routine: Routine,
    { scope, residentIds, roomIds }: Coverage,
    clinicId: string,
    keepsScope = false,
  ) {
    const takesResidents = scope === RoutineScope.SPECIFIC_RESIDENTS;
    const takesRooms = scope === RoutineScope.SPECIFIC_ROOM;
    if ((residentIds && !takesResidents) || (roomIds && !takesRooms)) {
      throw new BadRequestException(
        'residentIds go only with specificResidents and roomIds only with specificRoom',
      );
    }
    if (
      !keepsScope &&
      ((takesResidents && !residentIds) || (takesRooms && !roomIds))
    ) {
      throw new BadRequestException(
        `A ${scope} routine needs ${takesResidents ? 'residentIds' : 'roomIds'}`,
      );
    }

    routine.scope = scope;
    if (!takesResidents) routine.residents = [];
    if (!takesRooms) routine.rooms = [];
    if (residentIds) {
      routine.residents = await manager.findBy(Resident, {
        id: In(residentIds),
        clinicId,
      });
      if (routine.residents.length !== residentIds.length) {
        throw new ForbiddenException(
          'Every resident must be a resident of your clinic',
        );
      }
    }
    if (roomIds) {
      routine.rooms = await manager.findBy(Room, { id: In(roomIds), clinicId });
      if (routine.rooms.length !== roomIds.length) {
        throw new ForbiddenException(
          'Every room must be a room of your clinic',
        );
      }
    }
  }

  private async lockOwnRoutine(
    manager: EntityManager,
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<Routine> {
    if (!(await lockRoutine(manager, id))) {
      throw new NotFoundException(`Routine ${id} not found`);
    }
    const routine = await this.findOrThrow(manager, id);
    this.assertOwnClinic(routine, currentUser);
    return routine;
  }

  private async findOrThrow(
    manager: EntityManager,
    id: string,
  ): Promise<Routine> {
    const routine = await manager.findOne(Routine, {
      where: { id },
      relations: { residents: true, rooms: true },
    });
    if (!routine) {
      throw new NotFoundException(`Routine ${id} not found`);
    }
    return routine;
  }

  private assertOwnClinic(routine: Routine, currentUser: AuthenticatedUser) {
    if (routine.clinicId !== this.ownClinicId(currentUser)) {
      throw new ForbiddenException('Routine belongs to another clinic');
    }
  }

  private ownClinicId(currentUser: AuthenticatedUser): string {
    if (currentUser.role !== UserRole.STAFF || !currentUser.clinicId) {
      throw new ForbiddenException('Only staff members can do this');
    }
    return currentUser.clinicId;
  }
}
