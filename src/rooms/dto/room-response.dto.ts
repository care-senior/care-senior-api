import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto.js';
import type { Room } from '../entities/room.entity.js';
import { RoomStatus } from '../room-status.enum.js';

export class RoomOccupantDto {
  id!: string;

  name!: string;

  age!: number;
}

export class RoomResponseDto {
  id!: string;

  clinicId!: string;

  number!: string;

  floor!: string;

  wing!: string | null;

  capacity!: number;

  /** Residents in the room now, by name. */
  occupants!: RoomOccupantDto[];

  freeBeds!: number;

  @ApiProperty({ enum: RoomStatus, enumName: 'RoomStatus' })
  status!: RoomStatus;

  /** `occupants` comes from `room.residents`, so load that relation first. */
  static fromEntity(room: Room): RoomResponseDto {
    const dto = new RoomResponseDto();
    dto.id = room.id;
    dto.clinicId = room.clinicId;
    dto.number = room.number;
    dto.floor = room.floor;
    dto.wing = room.wing ?? null;
    dto.capacity = room.capacity;
    dto.occupants = room.residents
      .map(({ id, name, age }) => ({ id, name, age }))
      .sort((first, second) => first.name.localeCompare(second.name));
    dto.freeBeds = Math.max(room.capacity - dto.occupants.length, 0);
    dto.status = dto.freeBeds > 0 ? RoomStatus.VACANT : RoomStatus.OCCUPIED;
    return dto;
  }
}

export class RoomPageDto extends PaginatedResponseDto(RoomResponseDto) {}
