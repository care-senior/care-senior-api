import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ActivityType } from '../../../common/enums/index.js';
import { IsDateTimeWithOffset } from '../../../common/validators/date-time-with-offset.decorator.js';
import { IsResidentIdList } from './resident-ids.decorator.js';

export class CreateActivityDto {
  @ApiProperty({ enum: ActivityType, enumName: 'ActivityType' })
  @IsEnum(ActivityType)
  type!: ActivityType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  /** ISO 8601 with offset, e.g. `2026-10-13T10:00:00-03:00`. */
  @IsDateTimeWithOffset()
  scheduledTime!: string;

  /** Free complement whose meaning depends on the type (which exercise, what gathering). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  detail?: string;

  /** Only for a `medication` activity: the prescription of its single participant. */
  @IsOptional()
  @IsUUID()
  medicationId?: string;

  /** Residents of the caller clinic taking part. */
  @IsResidentIdList()
  residentIds!: string[];
}
