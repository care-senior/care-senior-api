import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { HealthRecordType } from '../../../common/enums/index.js';
import { IsDateTimeWithOffset } from '../../../common/validators/date-time-with-offset.decorator.js';

export class CreateHealthRecordDto {
  /** A resident of the caller clinic. */
  @IsUUID()
  residentId!: string;

  @ApiProperty({ enum: HealthRecordType, enumName: 'HealthRecordType' })
  @IsEnum(HealthRecordType)
  type!: HealthRecordType;

  /** Reading with its unit, e.g. `130/85 mmHg`; for `other`, also what was measured. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  value!: string;

  /** When it was measured; defaults to now and can't be in the future. */
  @IsOptional()
  @IsDateTimeWithOffset()
  recordedAt?: string;
}
