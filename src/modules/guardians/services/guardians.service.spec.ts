import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { InvitationsService } from '../../auth/services/invitations.service.js';
import { Clinic } from '../../clinics/entities/clinic.entity.js';
import { StaffRole, UserRole } from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { Resident } from '../../residents/entities/resident.entity.js';
import type { CreateGuardianDto } from '../dto/create-guardian.dto.js';
import { Guardian } from '../entities/guardian.entity.js';
import { GuardiansService } from './guardians.service.js';

function chainableQuery(result: Record<string, unknown>) {
  const query: Record<string, unknown> = {};
  for (const method of [
    'createQueryBuilder',
    'setLock',
    'where',
    'andWhere',
    'innerJoin',
  ]) {
    query[method] = vi.fn(() => query);
  }
  return Object.assign(query, result);
}

describe('GuardiansService', () => {
  let service: GuardiansService;
  const guardianRepository = {
    findOne: vi.fn(),
    merge: vi.fn((target: Guardian, changes: Partial<Guardian>) =>
      Object.assign(target, changes),
    ),
    save: vi.fn((entity: Guardian) => Promise.resolve(entity)),
  };
  const residentRepository = { createQueryBuilder: vi.fn() };
  const clinicRepository = { existsBy: vi.fn() };
  const invitations = { inviteGuardian: vi.fn(), prepareEmailChange: vi.fn() };
  const manager = {
    getRepository: vi.fn(),
    count: vi.fn(),
    create: vi.fn((entity: new () => object, data: object) =>
      Object.assign(new entity(), data),
    ),
    save: vi.fn((entity: object) =>
      Promise.resolve(Object.assign(entity, { id: 'created-id' })),
    ),
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
  const guardianUser: AuthenticatedUser = {
    id: 'guardian-1',
    role: UserRole.GUARDIAN,
  };
  const guardian = (overrides: Partial<Guardian> = {}): Guardian =>
    Object.assign(new Guardian(), {
      id: 'guardian-1',
      name: 'Fernanda Costa',
      email: 'fernanda@familia.com',
      cpf: '52998224725',
      contactedClinicIds: [],
      ...overrides,
    });
  const walkIn: CreateGuardianDto = {
    guardian: {
      name: 'Fernanda Costa',
      email: 'fernanda@familia.com',
      cpf: '52998224725',
    },
    resident: { name: 'Maria Aparecida', age: 82, roomId: 'room-1' },
  };
  const roomQuery = (room: object | null) =>
    manager.getRepository.mockReturnValue(
      chainableQuery({ getOne: vi.fn().mockResolvedValue(room) }),
    );

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        GuardiansService,
        { provide: getRepositoryToken(Guardian), useValue: guardianRepository },
        { provide: getRepositoryToken(Resident), useValue: residentRepository },
        { provide: getRepositoryToken(Clinic), useValue: clinicRepository },
        { provide: DataSource, useValue: dataSource },
        { provide: InvitationsService, useValue: invitations },
      ],
    }).compile();
    service = module.get(GuardiansService);
  });

  describe('create (walk-in)', () => {
    it('creates guardian and resident in the staff clinic, then invites the guardian', async () => {
      roomQuery({
        id: 'room-1',
        number: '12B',
        clinicId: 'clinic-1',
        capacity: 2,
      });
      manager.count.mockResolvedValue(1);

      const response = await service.create(walkIn, nurse);

      expect(response.resident).toMatchObject({
        clinicId: 'clinic-1',
        roomId: 'room-1',
        roomNumber: '12B',
      });
      expect(response.guardian.maskedCpf).toBe('•••.•••.•••-25');
      expect(invitations.inviteGuardian).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'fernanda@familia.com' }),
      );
    });

    it('refuses a full room and a room of another clinic', async () => {
      roomQuery({ id: 'room-1', clinicId: 'clinic-1', capacity: 1 });
      manager.count.mockResolvedValue(1);
      await expect(service.create(walkIn, nurse)).rejects.toBeInstanceOf(
        ConflictException,
      );

      roomQuery({ id: 'room-1', clinicId: 'clinic-2', capacity: 1 });
      await expect(service.create(walkIn, nurse)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(invitations.inviteGuardian).not.toHaveBeenCalled();
    });

    it('maps a duplicated e-mail to 409 and sends no invite', async () => {
      roomQuery({ id: 'room-1', clinicId: 'clinic-1', capacity: 1 });
      manager.count.mockResolvedValue(0);
      const duplicate = Object.assign(
        new QueryFailedError('INSERT', [], new Error('dup')),
        { driverError: { code: '23505' } },
      );
      dataSource.transaction.mockRejectedValueOnce(duplicate);

      await expect(service.create(walkIn, nurse)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(invitations.inviteGuardian).not.toHaveBeenCalled();
    });

    it('refuses guardians', async () => {
      await expect(service.create(walkIn, guardianUser)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('findOne', () => {
    it('shows the contacted clinics only to the guardian themself', async () => {
      guardianRepository.findOne.mockResolvedValue(
        guardian({ contactedClinicIds: ['clinic-1'] }),
      );

      const asSelf = await service.findOne('guardian-1', guardianUser);
      const asStaff = await service.findOne('guardian-1', nurse);

      expect(asSelf.contactedClinicIds).toEqual(['clinic-1']);
      expect(asStaff.contactedClinicIds).toBeUndefined();
    });

    it('refuses staff of a clinic unrelated to the guardian', async () => {
      guardianRepository.findOne.mockResolvedValue(guardian());
      residentRepository.createQueryBuilder.mockReturnValue(
        chainableQuery({ getExists: vi.fn().mockResolvedValue(false) }),
      );

      await expect(service.findOne('guardian-1', nurse)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('refuses another guardian', async () => {
      guardianRepository.findOne.mockResolvedValue(guardian({ id: 'other' }));

      await expect(
        service.findOne('other', guardianUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('contactClinic', () => {
    it("refuses to register another guardian's contact", async () => {
      await expect(
        service.contactClinic('other', { clinicId: 'clinic-1' }, guardianUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('answers 404 for an unknown clinic', async () => {
      clinicRepository.existsBy.mockResolvedValue(false);

      await expect(
        service.contactClinic(
          'guardian-1',
          { clinicId: 'missing' },
          guardianUser,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    const contacted = () => guardian({ contactedClinicIds: ['clinic-1'] });

    it('sends the invite to a corrected e-mail of a guardian not activated yet', async () => {
      guardianRepository.findOne.mockResolvedValue(contacted());

      const response = await service.update(
        'guardian-1',
        { email: 'fernanda.c@familia.com' },
        nurse,
      );

      expect(invitations.prepareEmailChange).toHaveBeenCalledWith(manager, {
        id: 'guardian-1',
        role: UserRole.GUARDIAN,
      });
      expect(invitations.inviteGuardian).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'fernanda.c@familia.com' }),
      );
      expect(response.email).toBe('fernanda.c@familia.com');
    });

    it('keeps the e-mail of an activated guardian', async () => {
      guardianRepository.findOne.mockResolvedValue(contacted());
      invitations.prepareEmailChange.mockRejectedValueOnce(
        new ConflictException(),
      );

      await expect(
        service.update('guardian-1', { email: 'other@mail.com' }, nurse),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(manager.save).not.toHaveBeenCalled();
      expect(invitations.inviteGuardian).not.toHaveBeenCalled();
    });

    it('edits the name without touching the invites', async () => {
      guardianRepository.findOne.mockResolvedValue(contacted());

      await service.update('guardian-1', { name: 'Fernanda C.' }, nurse);

      expect(invitations.prepareEmailChange).not.toHaveBeenCalled();
      expect(invitations.inviteGuardian).not.toHaveBeenCalled();
    });
  });

  it('only lets guardians update a guardian profile of their own', async () => {
    await expect(service.updateMe({ name: 'X' }, nurse)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
