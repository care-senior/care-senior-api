import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  HealthRecordType,
  StaffRole,
  UserRole,
} from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { Resident } from '../../residents/entities/resident.entity.js';
import { ResidentAccessService } from '../../residents/services/resident-access.service.js';
import { HealthRecordResponseDto } from '../dto/health-record-response.dto.js';
import { HealthRecord } from '../entities/health-record.entity.js';
import { HealthRecordsService } from './health-records.service.js';

describe('HealthRecordsService', () => {
  let service: HealthRecordsService;
  const healthRecordRepository = {
    createQueryBuilder: vi.fn(),
    create: vi.fn((data: object) => data),
    save: vi.fn((entity: object) => Promise.resolve({ id: 'hr-1', ...entity })),
    findOneOrFail: vi.fn(),
  };
  const residentRepository = { findOneBy: vi.fn() };
  const residentAccess = { assertCanView: vi.fn(), assertLinkedTo: vi.fn() };

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
  const resident = { id: 'resident-1', name: 'Maria', clinicId: 'clinic-1' };
  const reading = {
    residentId: 'resident-1',
    type: HealthRecordType.GLUCOSE,
    value: '98 mg/dL',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        HealthRecordsService,
        {
          provide: getRepositoryToken(HealthRecord),
          useValue: healthRecordRepository,
        },
        { provide: getRepositoryToken(Resident), useValue: residentRepository },
        { provide: ResidentAccessService, useValue: residentAccess },
      ],
    }).compile();
    service = module.get(HealthRecordsService);
  });

  describe('create', () => {
    it('records the reading as the caller, now by default', async () => {
      residentRepository.findOneBy.mockResolvedValue(resident);
      healthRecordRepository.findOneOrFail.mockResolvedValue({
        id: 'hr-1',
        ...reading,
        resident,
        recordedAt: new Date(),
        recordedBy: { id: caregiver.id, name: 'Bruno' },
      });

      await service.create(reading, caregiver);

      expect(residentAccess.assertLinkedTo).toHaveBeenCalledWith(
        resident,
        'clinic-1',
      );
      expect(healthRecordRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recordedByStaffId: caregiver.id,
          recordedAt: expect.any(Date),
        }),
      );
    });

    it('refuses guardians and readings in the future', async () => {
      await expect(service.create(reading, guardian)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        service.create(
          { ...reading, recordedAt: '2099-01-01T00:00:00Z' },
          caregiver,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(healthRecordRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('validates the period and keeps staff in their clinic', async () => {
      await expect(
        service.findAll(
          {
            page: 1,
            limit: 20,
            from: '2026-01-02T00:00:00Z',
            to: '2026-01-01T00:00:00Z',
          },
          caregiver,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

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
      healthRecordRepository.createQueryBuilder.mockReturnValue(query);
      await expect(
        service.findAll(
          { page: 1, limit: 20, clinicId: 'clinic-2' },
          caregiver,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('HealthRecordResponseDto', () => {
    it('only tells staff who recorded the reading', () => {
      const healthRecord = Object.assign(new HealthRecord(), {
        id: 'hr-1',
        ...reading,
        resident,
        recordedAt: new Date(),
        recordedBy: { id: caregiver.id, name: 'Bruno' },
      });

      expect(
        HealthRecordResponseDto.fromEntity(healthRecord, caregiver).recordedBy,
      ).toEqual({ id: caregiver.id, name: 'Bruno' });
      expect(
        HealthRecordResponseDto.fromEntity(healthRecord, guardian).recordedBy,
      ).toBeUndefined();
    });
  });
});
