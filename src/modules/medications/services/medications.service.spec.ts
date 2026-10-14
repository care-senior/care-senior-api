import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { ActivityParticipant } from '../../activities/entities/activity-participant.entity.js';
import {
  ActivityStatus,
  MedicationForm,
  StaffRole,
  UserRole,
} from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { Resident } from '../../residents/entities/resident.entity.js';
import { ResidentAccessService } from '../../residents/services/resident-access.service.js';
import { Medication } from '../entities/medication.entity.js';
import { MedicationsService } from './medications.service.js';

function chainableQuery() {
  const query: Record<string, unknown> = {};
  for (const method of [
    'innerJoin',
    'addSelect',
    'orderBy',
    'addOrderBy',
    'andWhere',
  ]) {
    query[method] = vi.fn(() => query);
  }
  return query;
}

describe('MedicationsService', () => {
  let service: MedicationsService;
  const medicationRepository = {
    createQueryBuilder: vi.fn(() => chainableQuery()),
    findOne: vi.fn(),
    create: vi.fn((data: object) => Object.assign(new Medication(), data)),
    merge: vi.fn((target: Medication, changes: Partial<Medication>) =>
      Object.assign(target, changes),
    ),
    save: vi.fn((entity: Medication) =>
      Promise.resolve(Object.assign(entity, { id: entity.id ?? 'med-1' })),
    ),
  };
  const residentRepository = { findOneBy: vi.fn() };
  const residentAccess = {
    assertCanView: vi.fn(),
    assertCanEditProfile: vi.fn(),
  };

  const dosesQuery = {
    setLock: vi.fn(() => dosesQuery),
    select: vi.fn(() => dosesQuery),
    where: vi.fn(() => dosesQuery),
    andWhere: vi.fn(() => dosesQuery),
    getMany: vi.fn((): Promise<{ id: string }[]> => Promise.resolve([])),
  };
  const manager = {
    getRepository: vi.fn(() => ({ createQueryBuilder: () => dosesQuery })),
    update: vi.fn(),
    save: medicationRepository.save,
  };
  const dataSource = {
    transaction: vi.fn((work: (m: typeof manager) => Promise<unknown>) =>
      work(manager),
    ),
  };

  const nurse: AuthenticatedUser = {
    id: 'staff-1',
    role: UserRole.STAFF,
    staffRole: StaffRole.NURSE,
    clinicId: 'clinic-1',
  };
  const resident = { id: 'resident-1', name: 'Maria', clinicId: 'clinic-1' };
  const medication = (overrides: Partial<Medication> = {}): Medication =>
    Object.assign(new Medication(), {
      id: 'med-1',
      residentId: 'resident-1',
      resident,
      name: 'Losartana',
      dosage: '50mg',
      form: MedicationForm.TABLET,
      frequency: '1x ao dia',
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: null,
      active: true,
      ...overrides,
    });

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        MedicationsService,
        {
          provide: getRepositoryToken(Medication),
          useValue: medicationRepository,
        },
        { provide: getRepositoryToken(Resident), useValue: residentRepository },
        { provide: ResidentAccessService, useValue: residentAccess },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = module.get(MedicationsService);
  });

  describe('findAll', () => {
    it('keeps staff in their own clinic', async () => {
      await expect(
        service.findAll({ page: 1, limit: 20, clinicId: 'clinic-2' }, nurse),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('create', () => {
    const dto = {
      residentId: 'resident-1',
      name: 'Losartana',
      dosage: '50mg',
      form: MedicationForm.TABLET,
      frequency: '1x ao dia',
    };

    it('checks who may edit the resident and starts the treatment now by default', async () => {
      residentRepository.findOneBy.mockResolvedValue(resident);

      const response = await service.create(dto, nurse);

      expect(residentAccess.assertCanEditProfile).toHaveBeenCalledWith(
        resident,
        nurse,
      );
      expect(response).toMatchObject({
        residentName: 'Maria',
        endDate: null,
        active: true,
      });
      expect(Date.now() - response.startDate.getTime()).toBeLessThan(5_000);
    });

    it('refuses an end date before the start date', async () => {
      residentRepository.findOneBy.mockResolvedValue(resident);

      await expect(
        service.create(
          {
            ...dto,
            startDate: '2026-02-01T00:00:00Z',
            endDate: '2026-01-01T00:00:00Z',
          },
          nurse,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(medicationRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('makes the treatment continuous with a null end date', async () => {
      medicationRepository.findOne.mockResolvedValue(
        medication({ endDate: new Date('2026-06-01T00:00:00Z') }),
      );

      const response = await service.update('med-1', { endDate: null }, nurse);

      expect(response.endDate).toBeNull();
    });

    it('cancels the doses after an end date brought forward', async () => {
      medicationRepository.findOne.mockResolvedValue(medication());
      dosesQuery.getMany.mockResolvedValueOnce([{ id: 'dose-1' }]);
      const endDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

      await service.update('med-1', { endDate: endDate.toISOString() }, nurse);

      expect(dosesQuery.andWhere).toHaveBeenCalledWith(
        'activity.scheduledTime > :after',
        { after: endDate },
      );
      expect(manager.update).toHaveBeenCalledWith(
        ActivityParticipant,
        expect.objectContaining({ activityId: In(['dose-1']) }),
        expect.objectContaining({
          status: ActivityStatus.CANCELLED,
          notes: 'Tratamento encerrado',
          registeredByStaffId: 'staff-1',
        }),
      );
    });

    it('refuses a deactivated medication', async () => {
      medicationRepository.findOne.mockResolvedValue(
        medication({ active: false }),
      );

      await expect(
        service.update('med-1', { dosage: '100mg' }, nurse),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('deactivate', () => {
    it('ends the treatment now unless it already ended in the past', async () => {
      medicationRepository.findOne.mockResolvedValueOnce(medication());
      const continuous = await service.deactivate('med-1', nurse);
      expect(continuous.active).toBe(false);
      expect(Date.now() - continuous.endDate!.getTime()).toBeLessThan(5_000);

      const pastEnd = new Date('2026-02-01T00:00:00Z');
      medicationRepository.findOne.mockResolvedValueOnce(
        medication({ endDate: pastEnd }),
      );
      const ended = await service.deactivate('med-1', nurse);
      expect(ended.endDate).toEqual(pastEnd);
    });

    it('cancels the doses still ahead and keeps the past ones', async () => {
      medicationRepository.findOne.mockResolvedValue(medication());
      dosesQuery.getMany.mockResolvedValueOnce([{ id: 'dose-1' }]);

      const ended = await service.deactivate('med-1', nurse);

      expect(dosesQuery.andWhere).toHaveBeenCalledWith(
        'activity.scheduledTime > :after',
        { after: ended.endDate },
      );
      expect(manager.update).toHaveBeenCalledWith(
        ActivityParticipant,
        {
          activityId: In(['dose-1']),
          status: In([
            ActivityStatus.PENDING,
            ActivityStatus.IN_PROGRESS,
            ActivityStatus.LATE,
          ]),
        },
        expect.objectContaining({ status: ActivityStatus.CANCELLED }),
      );
    });
  });
});
