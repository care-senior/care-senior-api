import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { StaffRole, UserRole } from '../common/enums/index.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface.js';
import { Room } from './entities/room.entity.js';
import { RoomStatus } from './room-status.enum.js';
import { RoomsService } from './rooms.service.js';

function chainableQuery(result: Record<string, unknown> = {}) {
  const query: Record<string, unknown> = {};
  for (const method of [
    'setLock',
    'where',
    'andWhere',
    'leftJoinAndSelect',
    'orderBy',
    'addOrderBy',
  ]) {
    query[method] = vi.fn(() => query);
  }
  return Object.assign(query, result);
}

describe('RoomsService', () => {
  let service: RoomsService;
  const roomRepository = {
    createQueryBuilder: vi.fn(() => chainableQuery()),
    findOne: vi.fn(),
    create: vi.fn((data: object) => ({ ...data })),
    save: vi.fn((entity: object) =>
      Promise.resolve({ id: 'room-1', ...entity }),
    ),
  };
  const lockedRoom = { current: null as Room | null };
  const manager = {
    getRepository: vi.fn(() => ({
      createQueryBuilder: () =>
        chainableQuery({
          getOne: vi.fn(() => Promise.resolve(lockedRoom.current)),
        }),
    })),
    count: vi.fn(),
    merge: vi.fn((_entity: unknown, target: Room, changes: Partial<Room>) =>
      Object.assign(target, changes),
    ),
    save: vi.fn(),
    delete: vi.fn(),
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
  const room = (overrides: Partial<Room> = {}): Room =>
    Object.assign(new Room(), {
      id: 'room-1',
      clinicId: 'clinic-1',
      number: '12B',
      floor: 'Térreo',
      capacity: 2,
      residents: [],
      ...overrides,
    });

  beforeEach(async () => {
    vi.clearAllMocks();
    lockedRoom.current = room();
    const module = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: getRepositoryToken(Room), useValue: roomRepository },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = module.get(RoomsService);
  });

  describe('findAll', () => {
    it('keeps staff in their clinic and refuses guardians', async () => {
      await expect(
        service.findAll({ page: 1, limit: 20, clinicId: 'clinic-2' }, nurse),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.findAll(
          { page: 1, limit: 20 },
          { id: 'guardian-1', role: UserRole.GUARDIAN },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('findOne', () => {
    it('reports free beds and the occupants by name', async () => {
      roomRepository.findOne.mockResolvedValue(
        room({
          residents: [
            { id: 'resident-2', name: 'Zilda', age: 90 },
            { id: 'resident-1', name: 'Antônia', age: 91 },
          ] as Room['residents'],
        }),
      );

      const response = await service.findOne('room-1', nurse);

      expect(response.occupants.map(({ name }) => name)).toEqual([
        'Antônia',
        'Zilda',
      ]);
      expect(response).toMatchObject({
        freeBeds: 0,
        status: RoomStatus.OCCUPIED,
      });
    });
  });

  describe('create', () => {
    it('creates the room in the staff clinic and maps a repeated number to 409', async () => {
      const dto = { number: '12B', floor: 'Térreo', capacity: 2 };

      await expect(service.create(dto, nurse)).resolves.toMatchObject({
        clinicId: 'clinic-1',
        freeBeds: 2,
        status: RoomStatus.VACANT,
      });

      roomRepository.save.mockRejectedValueOnce(
        Object.assign(new QueryFailedError('INSERT', [], new Error('dup')), {
          driverError: { code: '23505' },
        }),
      );
      await expect(service.create(dto, nurse)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('never lowers the capacity below the occupants', async () => {
      manager.count.mockResolvedValue(2);

      await expect(
        service.update('room-1', { capacity: 1 }, nurse),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('refuses a room of another clinic', async () => {
      lockedRoom.current = room({ clinicId: 'clinic-2' });

      await expect(
        service.update('room-1', { floor: '1º andar' }, nurse),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('deletes an empty room only', async () => {
      manager.count.mockResolvedValueOnce(1);
      await expect(service.remove('room-1', nurse)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(manager.delete).not.toHaveBeenCalled();

      manager.count.mockResolvedValueOnce(0);
      await service.remove('room-1', nurse);
      expect(manager.delete).toHaveBeenCalledWith(Room, 'room-1');
    });
  });
});
