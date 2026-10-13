import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { InvitationsService } from '../../auth/services/invitations.service.js';
import { StaffRole, UserRole } from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { Guardian } from '../../guardians/entities/guardian.entity.js';
import { Room } from '../../rooms/entities/room.entity.js';
import { Resident } from '../entities/resident.entity.js';
import { ResidentsService } from './residents.service.js';

function chainableQuery(result: Record<string, unknown> = {}) {
  const query: Record<string, unknown> = {};
  for (const method of [
    'select',
    'setLock',
    'where',
    'andWhere',
    'innerJoin',
    'leftJoinAndSelect',
    'orderBy',
    'addOrderBy',
  ]) {
    query[method] = vi.fn(() => query);
  }
  return Object.assign(query, result);
}

describe('ResidentsService', () => {
  let service: ResidentsService;
  const residentRepository = {
    createQueryBuilder: vi.fn(() => chainableQuery()),
    findOne: vi.fn(),
    merge: vi.fn((target: Resident, changes: Partial<Resident>) =>
      Object.assign(target, changes),
    ),
    save: vi.fn((entity: Resident) => Promise.resolve(entity)),
    update: vi.fn(),
  };
  const guardianQuery = { exists: false, guardianIds: [] as string[] };
  const guardianRepository = {
    createQueryBuilder: vi.fn(() =>
      chainableQuery({
        getExists: vi.fn(() => Promise.resolve(guardianQuery.exists)),
        getMany: vi.fn(() =>
          Promise.resolve(guardianQuery.guardianIds.map((id) => ({ id }))),
        ),
      }),
    ),
    create: vi.fn((data: object) => ({ ...data })),
    save: vi.fn(),
    manager: { getRepository: () => guardianRepository },
  };
  const invitations = { inviteGuardian: vi.fn() };
  const lockedRows = new Map<unknown, object | null>();
  const manager = {
    getRepository: vi.fn((entity: unknown) =>
      entity === Guardian
        ? guardianRepository
        : {
            createQueryBuilder: () =>
              chainableQuery({
                getOne: vi.fn().mockResolvedValue(lockedRows.get(entity)),
              }),
          },
    ),
    count: vi.fn().mockResolvedValue(0),
    update: vi.fn(),
    createQueryBuilder: vi.fn(),
  };
  const removeLink = vi.fn();
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
  const resident = (overrides: Partial<Resident> = {}): Resident =>
    Object.assign(new Resident(), {
      id: 'resident-1',
      name: 'Maria Aparecida',
      age: 82,
      clinicId: 'clinic-1',
      roomId: 'room-1',
      ...overrides,
    });

  beforeEach(async () => {
    vi.clearAllMocks();
    guardianQuery.exists = false;
    guardianQuery.guardianIds = [];
    manager.createQueryBuilder.mockReturnValue({
      relation: () => ({ of: () => ({ remove: removeLink }) }),
    });
    lockedRows.clear();
    lockedRows.set(Room, { id: 'room-2', clinicId: 'clinic-1', capacity: 2 });
    const module = await Test.createTestingModule({
      providers: [
        ResidentsService,
        { provide: getRepositoryToken(Resident), useValue: residentRepository },
        { provide: getRepositoryToken(Guardian), useValue: guardianRepository },
        { provide: DataSource, useValue: dataSource },
        { provide: InvitationsService, useValue: invitations },
      ],
    }).compile();
    service = module.get(ResidentsService);
  });

  describe('findAll', () => {
    it('keeps staff in their clinic and guardians in their own residents', async () => {
      await expect(
        service.findAll({ page: 1, limit: 20, clinicId: 'clinic-2' }, nurse),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.findAll(
          { page: 1, limit: 20, guardianId: 'guardian-2' },
          guardianUser,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('update', () => {
    it('lets the guardian edit the profile only before the link', async () => {
      guardianQuery.exists = true;
      residentRepository.findOne.mockResolvedValueOnce(
        resident({ clinicId: null, roomId: null }),
      );
      await expect(
        service.update('resident-1', { peculiarities: null }, guardianUser),
      ).resolves.toMatchObject({ peculiarities: null, clinicId: null });

      residentRepository.findOne.mockResolvedValueOnce(resident());
      await expect(
        service.update('resident-1', { age: 83 }, guardianUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets the staff edit only residents linked to their clinic', async () => {
      residentRepository.findOne.mockResolvedValue(
        resident({ clinicId: 'clinic-2' }),
      );

      await expect(
        service.update('resident-1', { age: 83 }, nurse),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(residentRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('link', () => {
    it('places a resident with a pending request in a room of the clinic', async () => {
      lockedRows.set(Resident, resident({ clinicId: null, roomId: null }));
      guardianQuery.exists = true;
      residentRepository.findOne.mockResolvedValue(
        resident({ roomId: 'room-2' }),
      );

      await service.link('resident-1', { roomId: 'room-2' }, nurse);

      expect(manager.update).toHaveBeenCalledWith(Resident, 'resident-1', {
        clinicId: 'clinic-1',
        roomId: 'room-2',
      });
    });

    it('refuses residents without a request for the clinic and residents already linked', async () => {
      lockedRows.set(Resident, resident({ clinicId: null, roomId: null }));
      await expect(
        service.link('resident-1', { roomId: 'room-2' }, nurse),
      ).rejects.toBeInstanceOf(ForbiddenException);

      lockedRows.set(Resident, resident({ clinicId: 'clinic-2' }));
      guardianQuery.exists = true;
      await expect(
        service.link('resident-1', { roomId: 'room-2' }, nurse),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(manager.update).not.toHaveBeenCalled();
    });
  });

  describe('discharge', () => {
    it('clears clinic and room of a resident of the clinic only', async () => {
      residentRepository.findOne.mockResolvedValueOnce(
        resident({ clinicId: 'clinic-2' }),
      );
      await expect(
        service.discharge('resident-1', nurse),
      ).rejects.toBeInstanceOf(ForbiddenException);

      residentRepository.findOne.mockResolvedValue(resident());
      await service.discharge('resident-1', nurse);
      expect(residentRepository.update).toHaveBeenCalledWith('resident-1', {
        clinicId: null,
        roomId: null,
      });
    });
  });

  describe('changeRoom', () => {
    it('does nothing when the resident is already in the room', async () => {
      lockedRows.set(Resident, resident());
      residentRepository.findOne.mockResolvedValue(resident());

      await service.changeRoom('resident-1', { roomId: 'room-1' }, nurse);

      expect(manager.update).not.toHaveBeenCalled();
      expect(manager.getRepository).not.toHaveBeenCalledWith(Room);
    });

    it('refuses a full room', async () => {
      lockedRows.set(Resident, resident());
      manager.count.mockResolvedValueOnce(2);

      await expect(
        service.changeRoom('resident-1', { roomId: 'room-2' }, nurse),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(manager.update).not.toHaveBeenCalled();
    });
  });

  describe('addGuardian', () => {
    const newGuardian = {
      name: 'Paulo Souza',
      email: 'paulo@familia.com',
      cpf: '52998224725',
    };

    it('creates the guardian linked to the resident and invites them', async () => {
      residentRepository.findOne.mockResolvedValue(resident());
      guardianRepository.save.mockImplementation((entity: object) =>
        Promise.resolve({ id: 'guardian-2', ...entity }),
      );

      const response = await service.addGuardian(
        'resident-1',
        newGuardian,
        nurse,
      );

      expect(guardianRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'paulo@familia.com',
          residents: [expect.objectContaining({ id: 'resident-1' })],
        }),
      );
      expect(response.maskedCpf).toBe('•••.•••.•••-25');
      expect(invitations.inviteGuardian).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'guardian-2' }),
      );
    });

    it('maps a duplicated e-mail to 409 and sends no invite', async () => {
      residentRepository.findOne.mockResolvedValue(resident());
      guardianRepository.save.mockRejectedValue(
        Object.assign(new QueryFailedError('INSERT', [], new Error('dup')), {
          driverError: { code: '23505' },
        }),
      );

      await expect(
        service.addGuardian('resident-1', newGuardian, nurse),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(invitations.inviteGuardian).not.toHaveBeenCalled();
    });
  });

  describe('removeGuardian', () => {
    it('unlinks one of the guardians of a resident of the clinic', async () => {
      lockedRows.set(Resident, resident());
      guardianQuery.guardianIds = ['guardian-1', 'guardian-2'];

      await service.removeGuardian('resident-1', 'guardian-2', nurse);

      expect(removeLink).toHaveBeenCalledWith('resident-1');
    });

    it('refuses the last guardian, strangers and residents of other clinics', async () => {
      lockedRows.set(Resident, resident());
      guardianQuery.guardianIds = ['guardian-1'];
      await expect(
        service.removeGuardian('resident-1', 'guardian-1', nurse),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        service.removeGuardian('resident-1', 'guardian-9', nurse),
      ).rejects.toBeInstanceOf(NotFoundException);

      lockedRows.set(Resident, resident({ clinicId: 'clinic-2' }));
      await expect(
        service.removeGuardian('resident-1', 'guardian-1', nurse),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(removeLink).not.toHaveBeenCalled();
    });
  });
});
