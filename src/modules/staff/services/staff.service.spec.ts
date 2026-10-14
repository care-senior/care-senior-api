import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { InvitationsService } from '../../auth/services/invitations.service.js';
import { SessionsService } from '../../auth/services/sessions.service.js';
import { StaffRole, UserRole } from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { StaffMember } from '../entities/staff-member.entity.js';
import { StaffService } from './staff.service.js';

describe('StaffService', () => {
  let service: StaffService;
  const staffRepository = {
    findOne: vi.fn(),
    create: vi.fn((data: Partial<StaffMember>) =>
      Object.assign(new StaffMember(), data),
    ),
    merge: vi.fn((target: StaffMember, changes: Partial<StaffMember>) =>
      Object.assign(target, changes),
    ),
    save: vi.fn((entity: StaffMember) =>
      Promise.resolve(
        Object.assign(entity, {
          id: entity.id ?? 'new-staff',
          createdAt: new Date(),
        }),
      ),
    ),
    count: vi.fn(),
  };
  const invitations = {
    inviteStaffMember: vi.fn(),
    prepareEmailChange: vi.fn(),
  };
  const sessions = { revokeAllForUser: vi.fn() };
  const manager = { save: staffRepository.save };
  const dataSource = {
    transaction: vi.fn((work: (m: typeof manager) => Promise<unknown>) =>
      work(manager),
    ),
  };

  const user = (staffRole: StaffRole, id = 'me'): AuthenticatedUser => ({
    id,
    role: UserRole.STAFF,
    staffRole,
    clinicId: 'clinic-1',
  });
  const coordinator = user(StaffRole.COORDINATOR);
  const nurse = user(StaffRole.NURSE);
  const guardian: AuthenticatedUser = {
    id: 'guardian-1',
    role: UserRole.GUARDIAN,
  };

  const staffMember = (overrides: Partial<StaffMember> = {}): StaffMember =>
    Object.assign(new StaffMember(), {
      id: 'staff-1',
      name: 'Bruno Kanashiro',
      email: 'bruno@clinica.com',
      staffRole: StaffRole.CAREGIVER,
      clinicId: 'clinic-1',
      cpf: '52998224725',
      createdAt: new Date(),
      deactivatedAt: null,
      ...overrides,
    });

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: getRepositoryToken(StaffMember), useValue: staffRepository },
        { provide: InvitationsService, useValue: invitations },
        { provide: SessionsService, useValue: sessions },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = module.get(StaffService);
  });

  describe('create', () => {
    it('creates the staff member in the creator clinic and sends the invite', async () => {
      const response = await service.create(
        {
          name: 'Larissa Prado',
          email: 'larissa@clinica.com',
          staffRole: StaffRole.CAREGIVER,
          cpf: '52998224725',
        },
        nurse,
      );

      expect(response).toMatchObject({
        clinicId: 'clinic-1',
        maskedCpf: '•••.•••.•••-25',
      });
      expect(response).not.toHaveProperty('cpf');
      expect(invitations.inviteStaffMember).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'larissa@clinica.com' }),
      );
    });

    it('only lets a coordinator create a coordinator', async () => {
      const dto = {
        name: 'Nova Coordenadora',
        email: 'nova@clinica.com',
        staffRole: StaffRole.COORDINATOR,
      };

      await expect(service.create(dto, nurse)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.create(dto, coordinator)).resolves.toBeDefined();
    });

    it('maps a duplicated e-mail to 409', async () => {
      const duplicate = new QueryFailedError('INSERT', [], new Error('dup'));
      Object.assign(duplicate, { driverError: { code: '23505' } });
      staffRepository.save.mockRejectedValueOnce(duplicate);

      await expect(
        service.create(
          { name: 'X', email: 'dup@clinica.com', staffRole: StaffRole.NURSE },
          coordinator,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(invitations.inviteStaffMember).not.toHaveBeenCalled();
    });

    it('refuses guardians', async () => {
      await expect(
        service.create(
          { name: 'X', email: 'x@y.com', staffRole: StaffRole.CAREGIVER },
          guardian,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('update', () => {
    it('forbids a nurse from promoting someone to coordinator', async () => {
      staffRepository.findOne.mockResolvedValue(staffMember());

      await expect(
        service.update('staff-1', { staffRole: StaffRole.COORDINATOR }, nurse),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('keeps at least one active coordinator in the clinic', async () => {
      staffRepository.findOne.mockResolvedValue(
        staffMember({ staffRole: StaffRole.COORDINATOR }),
      );
      staffRepository.count.mockResolvedValue(0);

      await expect(
        service.update('staff-1', { staffRole: StaffRole.NURSE }, coordinator),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('sends the invite to a corrected e-mail of someone not activated yet', async () => {
      staffRepository.findOne.mockResolvedValue(staffMember());

      const response = await service.update(
        'staff-1',
        { email: 'bruno.k@clinica.com' },
        coordinator,
      );

      expect(invitations.prepareEmailChange).toHaveBeenCalledWith(manager, {
        id: 'staff-1',
        role: UserRole.STAFF,
      });
      expect(invitations.inviteStaffMember).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'bruno.k@clinica.com' }),
      );
      expect(response.email).toBe('bruno.k@clinica.com');
    });

    it('keeps the e-mail of an activated account', async () => {
      staffRepository.findOne.mockResolvedValue(staffMember());
      invitations.prepareEmailChange.mockRejectedValueOnce(
        new ConflictException(),
      );

      await expect(
        service.update('staff-1', { email: 'other@clinica.com' }, nurse),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(staffRepository.save).not.toHaveBeenCalled();
      expect(invitations.inviteStaffMember).not.toHaveBeenCalled();
    });

    it('leaves the invites alone when the e-mail does not change', async () => {
      staffRepository.findOne.mockResolvedValue(staffMember());

      await service.update(
        'staff-1',
        { name: 'Bruno K.', email: 'bruno@clinica.com' },
        nurse,
      );

      expect(invitations.prepareEmailChange).not.toHaveBeenCalled();
      expect(invitations.inviteStaffMember).not.toHaveBeenCalled();
    });

    it('rejects staff members from another clinic', async () => {
      staffRepository.findOne.mockResolvedValue(
        staffMember({ clinicId: 'clinic-2' }),
      );

      await expect(
        service.update('staff-1', { name: 'X' }, coordinator),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('deactivate', () => {
    it('deactivates and ends every session of the staff member', async () => {
      staffRepository.findOne.mockResolvedValue(staffMember());

      await service.deactivate('staff-1', nurse);

      expect(staffRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ deactivatedAt: expect.any(Date) }),
      );
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith(
        'staff-1',
        UserRole.STAFF,
      );
    });

    it('does not let anyone deactivate themselves', async () => {
      await expect(
        service.deactivate('me', coordinator),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(staffRepository.findOne).not.toHaveBeenCalled();
    });

    it('does not deactivate the last active coordinator', async () => {
      staffRepository.findOne.mockResolvedValue(
        staffMember({ staffRole: StaffRole.COORDINATOR }),
      );
      staffRepository.count.mockResolvedValue(0);

      await expect(
        service.deactivate('staff-1', coordinator),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown staff member', async () => {
      staffRepository.findOne.mockResolvedValue(null);

      await expect(
        service.deactivate('missing', coordinator),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
