import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StaffRole, UserRole } from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { Guardian } from '../../guardians/entities/guardian.entity.js';
import { Resident } from '../../residents/entities/resident.entity.js';
import { ResidentAccessService } from '../../residents/services/resident-access.service.js';
import { StaffMember } from '../../staff/entities/staff-member.entity.js';
import { Message } from '../entities/message.entity.js';
import { MessagesService } from './messages.service.js';

describe('MessagesService', () => {
  let service: MessagesService;
  const messageRepository = {
    create: vi.fn((data: object) => data),
    save: vi.fn((entity: object) =>
      Promise.resolve({ id: 'message-1', sentAt: new Date(), ...entity }),
    ),
  };
  const residentRepository = { findOneBy: vi.fn() };
  const staffRepository = { findOne: vi.fn() };
  const guardianRepository = { findOne: vi.fn() };
  const residentAccess = {
    assertIsGuardianOf: vi.fn(),
    assertLinkedTo: vi.fn(),
  };

  const guardian: AuthenticatedUser = {
    id: 'guardian-1',
    role: UserRole.GUARDIAN,
  };
  const caregiver: AuthenticatedUser = {
    id: 'staff-1',
    role: UserRole.STAFF,
    staffRole: StaffRole.CAREGIVER,
    clinicId: 'clinic-1',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: getRepositoryToken(Message), useValue: messageRepository },
        { provide: getRepositoryToken(Resident), useValue: residentRepository },
        { provide: getRepositoryToken(StaffMember), useValue: staffRepository },
        { provide: getRepositoryToken(Guardian), useValue: guardianRepository },
        { provide: ResidentAccessService, useValue: residentAccess },
      ],
    }).compile();
    service = module.get(MessagesService);
  });

  it('signs the message with the account name, never the client input', async () => {
    residentRepository.findOneBy.mockResolvedValue({
      id: 'resident-1',
      clinicId: 'clinic-1',
    });
    staffRepository.findOne.mockResolvedValue({ id: 'staff-1', name: 'Bruno' });

    const response = await service.create(
      { residentId: 'resident-1', text: 'Ela almoçou bem' },
      caregiver,
    );

    expect(residentAccess.assertLinkedTo).toHaveBeenCalled();
    expect(response).toMatchObject({
      senderId: 'staff-1',
      senderRole: UserRole.STAFF,
      senderName: 'Bruno',
    });
  });

  it('refuses a resident without clinic and other families', async () => {
    residentRepository.findOneBy.mockResolvedValue({
      id: 'resident-1',
      clinicId: null,
    });
    await expect(
      service.create({ residentId: 'resident-1', text: 'Oi' }, guardian),
    ).rejects.toBeInstanceOf(ConflictException);

    residentAccess.assertIsGuardianOf.mockRejectedValueOnce(
      new ForbiddenException(),
    );
    await expect(
      service.create({ residentId: 'resident-1', text: 'Oi' }, guardian),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messageRepository.save).not.toHaveBeenCalled();
  });
});
