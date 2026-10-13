import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  ActivityStatus,
  ActivityType,
  StaffRole,
  UserRole,
} from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { Resident } from '../../residents/entities/resident.entity.js';
import { ActivitiesService } from './activities.service.js';
import { ActivityParticipant } from '../entities/activity-participant.entity.js';
import { Activity } from '../entities/activity.entity.js';

function chainableQuery(result: Record<string, unknown> = {}) {
  const query: Record<string, unknown> = {};
  for (const method of [
    'setLock',
    'where',
    'andWhere',
    'innerJoin',
    'innerJoinAndSelect',
    'leftJoin',
    'leftJoinAndSelect',
    'addSelect',
    'orderBy',
    'addOrderBy',
  ]) {
    query[method] = vi.fn(() => query);
  }
  return Object.assign(query, result);
}

describe('ActivitiesService', () => {
  let service: ActivitiesService;
  const visible = { activity: null as Activity | null };
  const activityRepository = {
    createQueryBuilder: vi.fn(() =>
      chainableQuery({
        getOne: vi.fn(() => Promise.resolve(visible.activity)),
      }),
    ),
    existsBy: vi.fn(),
  };
  const residentRepository = {
    countBy: vi.fn(),
    createQueryBuilder: vi.fn(() =>
      chainableQuery({ getExists: vi.fn().mockResolvedValue(false) }),
    ),
  };
  const locked = { activity: null as Activity | null };
  const manager = {
    getRepository: vi.fn(() => ({
      createQueryBuilder: () =>
        chainableQuery({
          getOne: vi.fn(() => Promise.resolve(locked.activity)),
        }),
    })),
    findBy: vi.fn(),
    existsBy: vi.fn(),
    update: vi.fn(),
    save: vi.fn(),
    merge: vi.fn(),
  };
  const dataSource = {
    transaction: vi.fn((work: (m: typeof manager) => Promise<unknown>) =>
      work(manager),
    ),
  };

  const caregiver: AuthenticatedUser = {
    id: 'staff-1',
    role: UserRole.STAFF,
    staffRole: StaffRole.CAREGIVER,
    clinicId: 'clinic-1',
  };
  const guardian: AuthenticatedUser = {
    id: 'guardian-1',
    role: UserRole.GUARDIAN,
  };
  const participant = (
    residentId: string,
    status: ActivityStatus,
  ): ActivityParticipant =>
    Object.assign(new ActivityParticipant(), {
      residentId,
      status,
      resident: { id: residentId, name: `Resident ${residentId}` },
      registeredBy: { id: 'staff-1', name: 'Bruno Kanashiro' },
    });
  const activity = (overrides: Partial<Activity> = {}): Activity =>
    Object.assign(new Activity(), {
      id: 'activity-1',
      clinicId: 'clinic-1',
      type: ActivityType.MEAL,
      title: 'Café',
      scheduledTime: new Date('2030-01-01T10:00:00Z'),
      participants: [],
      ...overrides,
    });

  beforeEach(async () => {
    vi.clearAllMocks();
    visible.activity = activity();
    locked.activity = activity();
    const module = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        { provide: getRepositoryToken(Activity), useValue: activityRepository },
        { provide: getRepositoryToken(Resident), useValue: residentRepository },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = module.get(ActivitiesService);
  });

  describe('findAll', () => {
    it('validates the window and keeps each role in its scope', async () => {
      await expect(
        service.findAll(
          {
            page: 1,
            limit: 20,
            from: '2030-01-02T00:00:00Z',
            to: '2030-01-01T00:00:00Z',
          },
          caregiver,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.findAll(
          { page: 1, limit: 20, clinicId: 'clinic-2' },
          caregiver,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.findAll(
          { page: 1, limit: 20, residentId: 'resident-9' },
          guardian,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('findOne', () => {
    it('reports a past pending participant as late and hides who registered from guardians', async () => {
      visible.activity = activity({
        scheduledTime: new Date('2020-01-01T10:00:00Z'),
        participants: [
          participant('resident-1', ActivityStatus.PENDING),
          participant('resident-2', ActivityStatus.COMPLETED),
        ],
      });

      const forStaff = await service.findOne('activity-1', caregiver);
      const forGuardian = await service.findOne('activity-1', guardian);

      expect(forStaff.participants.map(({ status }) => status)).toEqual([
        ActivityStatus.LATE,
        ActivityStatus.COMPLETED,
      ]);
      expect(forStaff.participants[1]?.registeredBy).toEqual({
        id: 'staff-1',
        name: 'Bruno Kanashiro',
      });
      expect(forGuardian.participants[1]?.registeredBy).toBeUndefined();
    });

    it('tells a missing activity from one the caller cannot see', async () => {
      visible.activity = null;
      activityRepository.existsBy.mockResolvedValueOnce(true);
      await expect(
        service.findOne('activity-1', guardian),
      ).rejects.toBeInstanceOf(ForbiddenException);

      activityRepository.existsBy.mockResolvedValueOnce(false);
      await expect(
        service.findOne('activity-1', guardian),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    it('refuses participants outside the staff clinic', async () => {
      residentRepository.countBy.mockResolvedValue(1);

      await expect(
        service.create(
          {
            type: ActivityType.MEAL,
            title: 'Café',
            scheduledTime: '2030-01-01T10:00:00Z',
            residentIds: ['resident-1', 'resident-2'],
          },
          caregiver,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('refuses an activity someone already started', async () => {
      manager.existsBy.mockResolvedValue(true);

      await expect(
        service.update('activity-1', { title: 'Almoço' }, caregiver),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(manager.save).not.toHaveBeenCalled();
    });
  });

  describe('outcomes', () => {
    it('completes the participant with who registered it', async () => {
      manager.findBy.mockResolvedValue([
        participant('resident-1', ActivityStatus.IN_PROGRESS),
      ]);

      await service.complete(
        'activity-1',
        'resident-1',
        { rating: 5 },
        caregiver,
      );

      expect(manager.update).toHaveBeenCalledWith(
        ActivityParticipant,
        expect.anything(),
        expect.objectContaining({
          status: ActivityStatus.COMPLETED,
          rating: 5,
          comment: null,
          registeredByStaffId: 'staff-1',
        }),
      );
    });

    it('applies a batch to every resident or to none', async () => {
      manager.findBy.mockResolvedValue([
        participant('resident-1', ActivityStatus.PENDING),
        participant('resident-2', ActivityStatus.SKIPPED),
      ]);
      await expect(
        service.skipBatch(
          'activity-1',
          { residentIds: ['resident-1', 'resident-2'], reason: 'Chuva' },
          caregiver,
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      manager.findBy.mockResolvedValue([
        participant('resident-1', ActivityStatus.PENDING),
      ]);
      await expect(
        service.completeBatch(
          'activity-1',
          { residentIds: ['resident-1', 'resident-3'] },
          caregiver,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('refuses an activity of another clinic', async () => {
      locked.activity = activity({ clinicId: 'clinic-2' });

      await expect(
        service.startAll('activity-1', caregiver),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(manager.update).not.toHaveBeenCalled();
    });
  });
});
