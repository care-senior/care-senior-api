import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { ResidentMood } from '../../common/enums/index.js';

export class ResidentResponseDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  age!: number;

  @Expose()
  healthNotes?: string | null;

  /** Null before the resident is linked to a clinic and after a discharge. */
  @Expose()
  clinicId?: string | null;

  @Expose()
  roomId?: string | null;

  @ApiPropertyOptional({ enum: ResidentMood, enumName: 'ResidentMood' })
  @Expose()
  mood?: ResidentMood | null;

  @Expose()
  peculiarities?: string | null;

  @Expose()
  photoPath?: string | null;

  @Expose()
  emergencyContactName?: string | null;

  @Expose()
  emergencyContactPhone?: string | null;
}
