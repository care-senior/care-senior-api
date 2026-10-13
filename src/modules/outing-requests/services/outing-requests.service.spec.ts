import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  OutingRequestStatus,
  StaffRole,
  UserRole,
} from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { NotifierService } from '../../notifications/services/notifier.service.js';
import { Resident } from '../../residents/entities/resident.entity.js';
import { ResidentAccessService } from '../../residents/services/resident-access.service.js';
import { OutingRequest } from '../entities/outing-request.entity.js';
import { OutingRequestsService } from './outing-requests.service.js';

describe('OutingRequestsService', () => {
  let service: OutingRequestsService;
  const notifier = { notify: vi.fn() };
  const outingRequestRepository = {
    findOne: vi.fn(),
    create: vi.fn((data: object) => data),
    save: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const residentRepository = { findOneBy: vi.fn() };
  const residentAccess = {
    assertIsGuardianOf: vi.fn(),
    assertLinkedTo: vi.fn(),
  };

  const guardian: AuthenticatedUser = {
    id: 'guardian-1',
    role: UserRole.GUARDIAN,
  };
  const coordinator: AuthenticatedUser = {
    id: 'staff-1',
    role: UserRole.STAFF,
    staffRole: StaffRole.COORDINATOR,
    clinicId: 'clinic-1',
  };
  const outingRequest = (overrides: Partial<OutingRequest> = {}) =>
    Object.assign(new OutingRequest(), {
      id: 'outing-1',
      residentId: 'resident-1',
      resident: { id: 'resident-1', name: 'Maria', clinicId: 'clinic-1' },
      guardianId: guardian.id,
      guardian: { id: guardian.id, name: 'Fernanda' },
      departureAt: new Date('2030-01-01T10:00:00Z'),
      returnAt: new Date('2030-01-01T18:00:00Z'),
      status: OutingRequestStatus.PENDING,
      createdAt: new Date(),
      ...overrides,
    });
  const createDto = {
    residentId: 'resident-1',
    departureAt: '2030-01-01T10:00:00Z',
    returnAt: '2030-01-01T18:00:00Z',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        OutingRequestsService,
        {
          provide: getRepositoryToken(OutingRequest),
          useValue: outingRequestRepository,
        },
        { provide: getRepositoryToken(Resident), useValue: residentRepository },
        { provide: ResidentAccessService, useValue: residentAccess },
        { provide: NotifierService, useValue: notifier },
      ],
    }).compile();
    service = module.get(OutingRequestsService);
  });

  describe('create', () => {
    it('only takes guardians and future periods', async () => {
      await expect(
        service.create(createDto, coordinator),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.create(
          {
            ...createDto,
            departureAt: '2020-01-01T10:00:00Z',
            returnAt: '2020-01-01T18:00:00Z',
          },
          guardian,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(outingRequestRepository.save).not.toHaveBeenCalled();
    });

    it('refuses a resident without clinic, since no one could approve it', async () => {
      residentRepository.findOneBy.mockResolvedValue({
        id: 'resident-1',
        clinicId: null,
      });

      await expect(service.create(createDto, guardian)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(residentAccess.assertIsGuardianOf).toHaveBeenCalledWith(
        'resident-1',
        guardian.id,
      );
    });
  });

  describe('approve', () => {
    it('answers only a pending request, once', async () => {
      outingRequestRepository.findOne.mockResolvedValue(outingRequest());
      outingRequestRepository.update.mockResolvedValue({ affected: 0 });

      await expect(
        service.approve('outing-1', coordinator),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(outingRequestRepository.update).toHaveBeenCalledWith(
        { id: 'outing-1', status: OutingRequestStatus.PENDING },
        expect.objectContaining({ status: OutingRequestStatus.APPROVED }),
      );
    });

    it('refuses a request of a resident of another clinic', async () => {
      outingRequestRepository.findOne.mockResolvedValue(outingRequest());
      residentAccess.assertLinkedTo.mockImplementationOnce(() => {
        throw new ForbiddenException();
      });

      await expect(
        service.reject('outing-1', { reason: 'No' }, coordinator),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(outingRequestRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('lets only the guardian who asked cancel, while pending', async () => {
      outingRequestRepository.findOne.mockResolvedValue(
        outingRequest({ guardianId: 'guardian-2' }),
      );
      await expect(service.cancel('outing-1', guardian)).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      outingRequestRepository.findOne.mockResolvedValue(outingRequest());
      outingRequestRepository.delete.mockResolvedValue({ affected: 0 });
      await expect(service.cancel('outing-1', guardian)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
