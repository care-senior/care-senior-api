import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { paginate } from '../common/dto/paginated-response.dto.js';
import { UserRole } from '../common/enums/index.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface.js';
import { isUniqueViolation } from '../common/utils/database-errors.js';
import type { CreateRoomDto } from './dto/create-room.dto.js';
import type { QueryRoomsDto } from './dto/query-rooms.dto.js';
import { RoomPageDto, RoomResponseDto } from './dto/room-response.dto.js';
import type { UpdateRoomDto } from './dto/update-room.dto.js';
import { Room } from './entities/room.entity.js';
import { countOccupants, lockRoom } from './room-occupancy.js';
import { RoomStatus } from './room-status.enum.js';

const OCCUPANTS_COUNT =
  '(SELECT COUNT(*) FROM residents occupancy WHERE occupancy.room_id = room.id)';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    query: QueryRoomsDto,
    currentUser: AuthenticatedUser,
  ): Promise<RoomPageDto> {
    const clinicId = this.ownClinicId(currentUser);
    if (query.clinicId && query.clinicId !== clinicId) {
      throw new ForbiddenException(
        'Staff can only list rooms of their own clinic',
      );
    }

    const queryBuilder = this.roomRepository
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.residents', 'occupant')
      .where('room.clinicId = :clinicId', { clinicId })
      .orderBy('room.floor', 'ASC')
      .addOrderBy('room.wing', 'ASC')
      .addOrderBy('room.number', 'ASC')
      .addOrderBy('room.id', 'ASC');

    if (query.status === RoomStatus.VACANT) {
      queryBuilder.andWhere(`${OCCUPANTS_COUNT} < room.capacity`);
    } else if (query.status === RoomStatus.OCCUPIED) {
      queryBuilder.andWhere(`${OCCUPANTS_COUNT} >= room.capacity`);
    }

    const result = await paginate(queryBuilder, query);
    return {
      ...result,
      data: result.data.map((room) => RoomResponseDto.fromEntity(room)),
    };
  }

  async findOne(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<RoomResponseDto> {
    return RoomResponseDto.fromEntity(
      await this.findInOwnClinicOrThrow(id, this.ownClinicId(currentUser)),
    );
  }

  async create(
    dto: CreateRoomDto,
    currentUser: AuthenticatedUser,
  ): Promise<RoomResponseDto> {
    const clinicId = this.ownClinicId(currentUser);
    const room = await this.saveCheckingNumber(() =>
      this.roomRepository.save(
        this.roomRepository.create({ ...dto, clinicId }),
      ),
    );
    return RoomResponseDto.fromEntity({ ...room, residents: [] });
  }

  async update(
    id: string,
    dto: UpdateRoomDto,
    currentUser: AuthenticatedUser,
  ): Promise<RoomResponseDto> {
    const clinicId = this.ownClinicId(currentUser);
    await this.saveCheckingNumber(() =>
      this.dataSource.transaction(async (manager) => {
        const room = await lockRoom(manager, id, clinicId);
        if (dto.capacity !== undefined) {
          const occupants = await countOccupants(manager, id);
          if (dto.capacity < occupants) {
            throw new ConflictException(
              `Room ${room.number} has ${occupants} residents`,
            );
          }
        }
        await manager.save(manager.merge(Room, room, dto));
      }),
    );
    return this.findOne(id, currentUser);
  }

  async remove(id: string, currentUser: AuthenticatedUser): Promise<void> {
    const clinicId = this.ownClinicId(currentUser);
    await this.dataSource.transaction(async (manager) => {
      const room = await lockRoom(manager, id, clinicId);
      if ((await countOccupants(manager, id)) > 0) {
        throw new ConflictException(`Room ${room.number} is not empty`);
      }
      await manager.delete(Room, id);
    });
  }

  private async saveCheckingNumber<T>(save: () => Promise<T>): Promise<T> {
    try {
      return await save();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Room number already registered');
      }
      throw error;
    }
  }

  private async findInOwnClinicOrThrow(
    id: string,
    clinicId: string,
  ): Promise<Room> {
    const room = await this.roomRepository.findOne({
      where: { id },
      relations: { residents: true },
    });
    if (!room) {
      throw new NotFoundException(`Room ${id} not found`);
    }
    if (room.clinicId !== clinicId) {
      throw new ForbiddenException('Room belongs to another clinic');
    }
    return room;
  }

  private ownClinicId(currentUser: AuthenticatedUser): string {
    if (currentUser.role !== UserRole.STAFF || !currentUser.clinicId) {
      throw new ForbiddenException('Only staff members can do this');
    }
    return currentUser.clinicId;
  }
}
