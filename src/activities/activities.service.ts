import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  type EntityManager,
  In,
  Not,
  Repository,
  type SelectQueryBuilder,
} from 'typeorm';
import { paginate } from '../common/dto/paginated-response.dto.js';
import { ActivityStatus, UserRole } from '../common/enums/index.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface.js';
import { Resident } from '../residents/entities/resident.entity.js';
import {
  ActivityPageDto,
  ActivityResponseDto,
} from './dto/activity-response.dto.js';
import type { CreateActivityDto } from './dto/create-activity.dto.js';
import type {
  CompleteParticipantDto,
  CompleteParticipantsDto,
  SkipParticipantDto,
  SkipParticipantsDto,
} from './dto/participant-outcome.dto.js';
import type { QueryActivitiesDto } from './dto/query-activities.dto.js';
import type { UpdateActivityDto } from './dto/update-activity.dto.js';
import { ActivityParticipant } from './entities/activity-participant.entity.js';
import { Activity } from './entities/activity.entity.js';

const OPEN_STATUSES = [
  ActivityStatus.PENDING,
  ActivityStatus.IN_PROGRESS,
  ActivityStatus.LATE,
];

type Outcome = Pick<
  ActivityParticipant,
  'status' | 'rating' | 'comment' | 'notes'
>;

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(Activity)
    private readonly activityRepository: Repository<Activity>,
    @InjectRepository(Resident)
    private readonly residentRepository: Repository<Resident>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    query: QueryActivitiesDto,
    currentUser: AuthenticatedUser,
  ): Promise<ActivityPageDto> {
    if (query.from && query.to && new Date(query.to) <= new Date(query.from)) {
      throw new BadRequestException('to must be after from');
    }

    const queryBuilder = this.visibleActivitiesQuery(currentUser)
      .orderBy('activity.scheduledTime', 'ASC')
      .addOrderBy('activity.id', 'ASC');

    if (currentUser.role === UserRole.GUARDIAN) {
      if (query.residentId) {
        await this.assertIsGuardianOf(query.residentId, currentUser.id);
      }
      if (query.clinicId) {
        queryBuilder.andWhere('activity.clinicId = :clinicId', {
          clinicId: query.clinicId,
        });
      }
    } else {
      const clinicId = this.ownClinicId(currentUser);
      if (query.clinicId && query.clinicId !== clinicId) {
        throw new ForbiddenException(
          'Staff can only list activities of their own clinic',
        );
      }
      queryBuilder.andWhere('activity.clinicId = :clinicId', { clinicId });
    }

    if (query.residentId) {
      queryBuilder.andWhere(
        `EXISTS (
          SELECT 1 FROM activity_participants filtered
          WHERE filtered.activity_id = activity.id
            AND filtered.resident_id = :residentId
        )`,
        { residentId: query.residentId },
      );
    }
    if (query.from) {
      queryBuilder.andWhere('activity.scheduledTime >= :from', {
        from: new Date(query.from),
      });
    }
    if (query.to) {
      queryBuilder.andWhere('activity.scheduledTime < :to', {
        to: new Date(query.to),
      });
    }

    const result = await paginate(queryBuilder, query);
    const now = new Date();
    return {
      ...result,
      data: result.data.map((activity) =>
        ActivityResponseDto.fromEntity(activity, currentUser, now),
      ),
    };
  }

  async findOne(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<ActivityResponseDto> {
    const activity = await this.visibleActivitiesQuery(currentUser)
      .andWhere('activity.id = :id', { id })
      .getOne();
    if (!activity) {
      if (await this.activityRepository.existsBy({ id })) {
        throw new ForbiddenException(
          'None of your residents takes part in this activity',
        );
      }
      throw new NotFoundException(`Activity ${id} not found`);
    }
    if (
      currentUser.role === UserRole.STAFF &&
      activity.clinicId !== this.ownClinicId(currentUser)
    ) {
      throw new ForbiddenException('Activity belongs to another clinic');
    }
    return ActivityResponseDto.fromEntity(activity, currentUser);
  }

  async create(
    dto: CreateActivityDto,
    currentUser: AuthenticatedUser,
  ): Promise<ActivityResponseDto> {
    const clinicId = this.ownClinicId(currentUser);
    const { residentIds, scheduledTime, ...fields } = dto;
    await this.assertResidentsOfClinic(residentIds, clinicId);

    const id = await this.dataSource.transaction(async (manager) => {
      const activity = await manager.save(
        manager.create(Activity, {
          ...fields,
          scheduledTime: new Date(scheduledTime),
          clinicId,
        }),
      );
      await manager.insert(
        ActivityParticipant,
        residentIds.map((residentId) => ({
          activityId: activity.id,
          residentId,
        })),
      );
      return activity.id;
    });
    return this.findOne(id, currentUser);
  }

  async update(
    id: string,
    dto: UpdateActivityDto,
    currentUser: AuthenticatedUser,
  ): Promise<ActivityResponseDto> {
    const clinicId = this.ownClinicId(currentUser);
    const { residentIds, scheduledTime, ...fields } = dto;
    if (residentIds) {
      await this.assertResidentsOfClinic(residentIds, clinicId);
    }

    await this.dataSource.transaction(async (manager) => {
      const activity = await this.lockActivity(manager, id, clinicId);
      const hasStarted = await manager.existsBy(ActivityParticipant, {
        activityId: id,
        status: Not(ActivityStatus.PENDING),
      });
      if (hasStarted) {
        throw new ConflictException(
          'Only activities not started yet can be edited',
        );
      }

      await manager.save(
        manager.merge(Activity, activity, {
          ...fields,
          ...(scheduledTime && { scheduledTime: new Date(scheduledTime) }),
        }),
      );
      if (residentIds) {
        await manager.delete(ActivityParticipant, {
          activityId: id,
          residentId: Not(In(residentIds)),
        });
        await manager
          .createQueryBuilder()
          .insert()
          .into(ActivityParticipant)
          .values(
            residentIds.map((residentId) => ({ activityId: id, residentId })),
          )
          .orIgnore()
          .execute();
      }
    });
    return this.findOne(id, currentUser);
  }

  async startAll(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<ActivityResponseDto> {
    const clinicId = this.ownClinicId(currentUser);
    await this.dataSource.transaction(async (manager) => {
      await this.lockActivity(manager, id, clinicId);
      await manager.update(
        ActivityParticipant,
        { activityId: id, status: ActivityStatus.PENDING },
        {
          status: ActivityStatus.IN_PROGRESS,
          statusChangedAt: new Date(),
          registeredByStaffId: currentUser.id,
        },
      );
    });
    return this.findOne(id, currentUser);
  }

  complete(
    id: string,
    residentId: string,
    { rating, comment }: CompleteParticipantDto,
    currentUser: AuthenticatedUser,
  ): Promise<ActivityResponseDto> {
    return this.registerOutcome(
      id,
      [residentId],
      completedOutcome(rating, comment),
      currentUser,
    );
  }

  skip(
    id: string,
    residentId: string,
    { reason }: SkipParticipantDto,
    currentUser: AuthenticatedUser,
  ): Promise<ActivityResponseDto> {
    return this.registerOutcome(
      id,
      [residentId],
      skippedOutcome(reason),
      currentUser,
    );
  }

  completeBatch(
    id: string,
    { residentIds, rating, comment }: CompleteParticipantsDto,
    currentUser: AuthenticatedUser,
  ): Promise<ActivityResponseDto> {
    return this.registerOutcome(
      id,
      residentIds,
      completedOutcome(rating, comment),
      currentUser,
    );
  }

  skipBatch(
    id: string,
    { residentIds, reason }: SkipParticipantsDto,
    currentUser: AuthenticatedUser,
  ): Promise<ActivityResponseDto> {
    return this.registerOutcome(
      id,
      residentIds,
      skippedOutcome(reason),
      currentUser,
    );
  }

  // A batch is all or nothing: if one resident can't take the outcome, none
  // of them does, so the client never has to work out a partial result.
  private async registerOutcome(
    id: string,
    residentIds: string[],
    outcome: Outcome,
    currentUser: AuthenticatedUser,
  ): Promise<ActivityResponseDto> {
    const clinicId = this.ownClinicId(currentUser);
    await this.dataSource.transaction(async (manager) => {
      await this.lockActivity(manager, id, clinicId);
      const participants = await manager.findBy(ActivityParticipant, {
        activityId: id,
        residentId: In(residentIds),
      });

      const missing = residentIds.filter(
        (residentId) =>
          !participants.some(
            (participant) => participant.residentId === residentId,
          ),
      );
      if (missing.length > 0) {
        throw new NotFoundException(
          `Residents ${missing.join(', ')} are not participants of activity ${id}`,
        );
      }
      const closed = participants.filter(
        ({ status }) => !OPEN_STATUSES.includes(status),
      );
      if (closed.length > 0) {
        throw new ConflictException(
          `Residents ${closed.map(({ residentId }) => residentId).join(', ')} already have an outcome`,
        );
      }

      await manager.update(
        ActivityParticipant,
        { activityId: id, residentId: In(residentIds) },
        {
          ...outcome,
          statusChangedAt: new Date(),
          registeredByStaffId: currentUser.id,
        },
      );
    });
    return this.findOne(id, currentUser);
  }

  // A guardian only gets the participants who are their residents: ratings,
  // comments and skip reasons of other families' residents stay private.
  private visibleActivitiesQuery(
    currentUser: AuthenticatedUser,
  ): SelectQueryBuilder<Activity> {
    const queryBuilder = this.activityRepository.createQueryBuilder('activity');
    if (currentUser.role === UserRole.GUARDIAN) {
      queryBuilder.innerJoinAndSelect(
        'activity.participants',
        'participant',
        `EXISTS (
          SELECT 1 FROM guardian_resident link
          WHERE link.resident_id = participant.resident_id
            AND link.guardian_id = :guardianId
        )`,
        { guardianId: currentUser.id },
      );
    } else {
      queryBuilder.leftJoinAndSelect('activity.participants', 'participant');
    }
    return queryBuilder
      .leftJoin('participant.resident', 'resident')
      .addSelect(['resident.id', 'resident.name'])
      .leftJoin('participant.registeredBy', 'registeredBy')
      .addSelect(['registeredBy.id', 'registeredBy.name']);
  }

  // Locks the activity row so edits and outcomes on the same activity run one
  // after the other: an edit never slips in after a participant started.
  private async lockActivity(
    manager: EntityManager,
    id: string,
    clinicId: string,
  ): Promise<Activity> {
    const activity = await manager
      .getRepository(Activity)
      .createQueryBuilder('activity')
      .setLock('pessimistic_write')
      .where('activity.id = :id', { id })
      .getOne();
    if (!activity) {
      throw new NotFoundException(`Activity ${id} not found`);
    }
    if (activity.clinicId !== clinicId) {
      throw new ForbiddenException('Activity belongs to another clinic');
    }
    return activity;
  }

  private async assertResidentsOfClinic(
    residentIds: string[],
    clinicId: string,
  ) {
    const residentsInClinic = await this.residentRepository.countBy({
      id: In(residentIds),
      clinicId,
    });
    if (residentsInClinic !== residentIds.length) {
      throw new ForbiddenException(
        'Every participant must be a resident of your clinic',
      );
    }
  }

  private async assertIsGuardianOf(residentId: string, guardianId: string) {
    const isGuardian = await this.residentRepository
      .createQueryBuilder('resident')
      .innerJoin(
        'resident.guardians',
        'guardian',
        'guardian.id = :guardianId',
        {
          guardianId,
        },
      )
      .where('resident.id = :residentId', { residentId })
      .getExists();
    if (!isGuardian) {
      throw new ForbiddenException('Resident belongs to another guardian');
    }
  }

  private ownClinicId(currentUser: AuthenticatedUser): string {
    if (currentUser.role !== UserRole.STAFF || !currentUser.clinicId) {
      throw new ForbiddenException('Only staff members can do this');
    }
    return currentUser.clinicId;
  }
}

function completedOutcome(rating?: number, comment?: string): Outcome {
  return {
    status: ActivityStatus.COMPLETED,
    rating: rating ?? null,
    comment: comment ?? null,
    notes: null,
  };
}

function skippedOutcome(reason: string): Outcome {
  return {
    status: ActivityStatus.SKIPPED,
    rating: null,
    comment: null,
    notes: reason,
  };
}
