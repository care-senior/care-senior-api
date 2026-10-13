import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  ActivityType,
  RoutineScope,
  StaffRole,
  UserRole,
  Weekday,
} from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { Resident } from '../../residents/entities/resident.entity.js';
import { Room } from '../../rooms/entities/room.entity.js';
import { Routine } from '../entities/routine.entity.js';
import { RoutineActivitiesService } from './routine-activities.service.js';
import { RoutinesService } from './routines.service.js';

describe('RoutinesService', () => {
  let service: RoutinesService;
  const routineActivities = {
    rebuild: vi.fn(),
    removeManagedActivities: vi.fn(),
  };
  const lockedRoutine = { getOne: vi.fn() };
  const manager = {
    create: vi.fn((_entity: unknown, data: object) =>
      Object.assign(new Routine(), data),
    ),
    merge: vi.fn((_entity: unknown, target: object, changes: object) =>
      Object.assign(target, changes),
    ),
    save: vi.fn((routine: Routine) =>
      Promise.resolve(
        Object.assign(routine, { id: routine.id ?? 'routine-1' }),
      ),
    ),
    update: vi.fn(),
    delete: vi.fn(),
    findBy: vi.fn(),
    findOne: vi.fn(),
    createQueryBuilder: vi.fn(() => ({
      setLock: () => ({ where: () => lockedRoutine }),
    })),
  };
  const dataSource = {
    manager,
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
  const routine = (overrides: Partial<Routine> = {}) =>
    Object.assign(new Routine(), {
      id: 'routine-1',
      clinicId: 'clinic-1',
      title: 'Aferição de pressão',
      activityType: ActivityType.VITAL_SIGNS,
      time: '07:00',
      weekdays: [Weekday.MON],
      scope: RoutineScope.SPECIFIC_RESIDENTS,
      residents: [{ id: 'resident-1', name: 'Maria' }],
      rooms: [],
      active: true,
      ...overrides,
    });
  const fields = {
    title: 'Banho assistido',
    activityType: ActivityType.HYGIENE,
    time: '14:00',
    weekdays: [Weekday.MON],
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    lockedRoutine.getOne.mockResolvedValue({ id: 'routine-1' });
    manager.findOne.mockResolvedValue(routine());
    const module = await Test.createTestingModule({
      providers: [
        RoutinesService,
        { provide: getRepositoryToken(Routine), useValue: {} },
        { provide: DataSource, useValue: dataSource },
        { provide: RoutineActivitiesService, useValue: routineActivities },
      ],
    }).compile();
    service = module.get(RoutinesService);
  });

  describe('create', () => {
    it('saves the routine of the caller clinic and generates its activities', async () => {
      manager.findBy.mockResolvedValue([{ id: 'resident-1' }]);

      await service.create(
        {
          ...fields,
          scope: RoutineScope.SPECIFIC_RESIDENTS,
          residentIds: ['resident-1'],
        },
        caregiver,
      );

      expect(manager.findBy).toHaveBeenCalledWith(
        Resident,
        expect.objectContaining({ clinicId: 'clinic-1' }),
      );
      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          clinicId: 'clinic-1',
          residents: [{ id: 'resident-1' }],
          rooms: [],
        }),
      );
      expect(routineActivities.rebuild).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({ id: 'routine-1' }),
        expect.any(Date),
      );
    });

    it('takes residents and rooms only with their scope, and only of the clinic', async () => {
      for (const coverage of [
        { scope: RoutineScope.SPECIFIC_RESIDENTS },
        { scope: RoutineScope.SPECIFIC_ROOM },
        { scope: RoutineScope.ALL_RESIDENTS, residentIds: ['resident-1'] },
        { scope: RoutineScope.SPECIFIC_RESIDENTS, roomIds: ['room-1'] },
      ]) {
        await expect(
          service.create({ ...fields, ...coverage }, caregiver),
        ).rejects.toBeInstanceOf(BadRequestException);
      }

      manager.findBy.mockResolvedValue([]);
      await expect(
        service.create(
          { ...fields, scope: RoutineScope.SPECIFIC_ROOM, roomIds: ['room-2'] },
          caregiver,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(manager.findBy).toHaveBeenCalledWith(
        Room,
        expect.objectContaining({ clinicId: 'clinic-1' }),
      );
      await expect(
        service.create(
          { ...fields, scope: RoutineScope.ALL_RESIDENTS },
          guardian,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(manager.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('keeps the residents when the scope stays and clears them when it changes', async () => {
      await service.update('routine-1', { time: '08:00' }, caregiver);
      expect(manager.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          time: '08:00',
          residents: [{ id: 'resident-1', name: 'Maria' }],
        }),
      );

      await service.update(
        'routine-1',
        { scope: RoutineScope.ALL_RESIDENTS },
        caregiver,
      );
      expect(manager.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          scope: RoutineScope.ALL_RESIDENTS,
          residents: [],
        }),
      );
      expect(routineActivities.rebuild).toHaveBeenCalledTimes(2);
    });

    it('refuses routines of other clinics and missing ones', async () => {
      manager.findOne.mockResolvedValue(routine({ clinicId: 'clinic-2' }));
      await expect(
        service.update('routine-1', { time: '08:00' }, caregiver),
      ).rejects.toBeInstanceOf(ForbiddenException);

      lockedRoutine.getOne.mockResolvedValue(null);
      await expect(
        service.remove('routine-1', caregiver),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(manager.save).not.toHaveBeenCalled();
      expect(manager.delete).not.toHaveBeenCalled();
    });
  });

  describe('toggle', () => {
    it('pauses an active routine and rebuilds its activities', async () => {
      await service.toggle('routine-1', caregiver);

      expect(manager.update).toHaveBeenCalledWith(Routine, 'routine-1', {
        active: false,
      });
      expect(routineActivities.rebuild).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({ active: false }),
        expect.any(Date),
      );
    });
  });
});
