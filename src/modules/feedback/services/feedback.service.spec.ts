import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StaffRole, UserRole } from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { Guardian } from '../../guardians/entities/guardian.entity.js';
import { Resident } from '../../residents/entities/resident.entity.js';
import { StaffMember } from '../../staff/entities/staff-member.entity.js';
import { UserFeedback } from '../entities/user-feedback.entity.js';
import { FeedbackService } from './feedback.service.js';

function chainableQuery(result: Record<string, unknown>) {
  const query: Record<string, unknown> = { ...result };
  for (const method of [
    'select',
    'innerJoin',
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
  ]) {
    query[method] = vi.fn(() => query);
  }
  return query;
}

describe('FeedbackService', () => {
  let service: FeedbackService;
  const feedbackRepository = {
    createQueryBuilder: vi.fn(),
    create: vi.fn((data: object) => data),
    save: vi.fn((entity: object) =>
      Promise.resolve({ id: 'feedback-1', sentAt: new Date(), ...entity }),
    ),
  };
  const staffRepository = {
    findOne: vi.fn(() => Promise.resolve({ id: 'staff-1', name: 'Bruno' })),
  };
  const guardianRepository = {
    findOne: vi.fn(() =>
      Promise.resolve({ id: 'guardian-1', name: 'Fernanda' }),
    ),
  };
  const residentRepository = { createQueryBuilder: vi.fn() };

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
  const review = { rating: 4, message: 'Muito útil' };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        FeedbackService,
        {
          provide: getRepositoryToken(UserFeedback),
          useValue: feedbackRepository,
        },
        { provide: getRepositoryToken(StaffMember), useValue: staffRepository },
        { provide: getRepositoryToken(Guardian), useValue: guardianRepository },
        { provide: getRepositoryToken(Resident), useValue: residentRepository },
      ],
    }).compile();
    service = module.get(FeedbackService);
  });

  describe('create', () => {
    it("sends a staff member's feedback to their clinic", async () => {
      const response = await service.create(review, caregiver);

      expect(feedbackRepository.create).toHaveBeenCalledWith({
        authorId: 'staff-1',
        authorRole: UserRole.STAFF,
        authorName: 'Bruno',
        clinicIds: ['clinic-1'],
        ...review,
      });
      expect(response).not.toHaveProperty('clinicIds');
    });

    it("sends a guardian's feedback to the clinics of their residents", async () => {
      residentRepository.createQueryBuilder.mockReturnValue(
        chainableQuery({
          getRawMany: () =>
            Promise.resolve([
              { clinicId: 'clinic-1' },
              { clinicId: 'clinic-2' },
            ]),
        }),
      );

      await service.create(review, guardian);

      expect(feedbackRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          authorName: 'Fernanda',
          authorRole: UserRole.GUARDIAN,
          clinicIds: ['clinic-1', 'clinic-2'],
        }),
      );
    });
  });

  describe('findAll', () => {
    it('keeps staff in their own clinic', async () => {
      await expect(
        service.findAll(
          { page: 1, limit: 20, clinicId: 'clinic-2' },
          caregiver,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.findAll({ page: 1, limit: 20 }, guardian),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(feedbackRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
