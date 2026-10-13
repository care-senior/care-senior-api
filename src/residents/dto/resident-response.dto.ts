import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto.js';
import { ResidentMood } from '../../common/enums/index.js';
import type { Resident } from '../entities/resident.entity.js';

export class ResidentResponseDto {
  id!: string;

  name!: string;

  age!: number;

  healthNotes!: string | null;

  /** Null before the resident is linked to a clinic and after a discharge. */
  clinicId!: string | null;

  roomId!: string | null;

  roomNumber!: string | null;

  @ApiProperty({ enum: ResidentMood, enumName: 'ResidentMood', nullable: true })
  mood!: ResidentMood | null;

  peculiarities!: string | null;

  photoPath!: string | null;

  emergencyContactName!: string | null;

  emergencyContactPhone!: string | null;

  /** `roomNumber` comes from `resident.room`, so load that relation first. */
  static fromEntity(resident: Resident): ResidentResponseDto {
    const dto = new ResidentResponseDto();
    dto.id = resident.id;
    dto.name = resident.name;
    dto.age = resident.age;
    dto.healthNotes = resident.healthNotes ?? null;
    dto.clinicId = resident.clinicId ?? null;
    dto.roomId = resident.roomId ?? null;
    dto.roomNumber = resident.roomNumber ?? null;
    dto.mood = resident.mood ?? null;
    dto.peculiarities = resident.peculiarities ?? null;
    dto.photoPath = resident.photoPath ?? null;
    dto.emergencyContactName = resident.emergencyContactName ?? null;
    dto.emergencyContactPhone = resident.emergencyContactPhone ?? null;
    return dto;
  }
}

export class ResidentPageDto extends PaginatedResponseDto(
  ResidentResponseDto,
) {}
