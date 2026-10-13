import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ActivityType } from '../../common/enums/index.js';
import { IsDateTimeWithOffset } from '../../common/validators/date-time-with-offset.decorator.js';
import { IsOptionalNotNull } from '../../common/validators/optional-not-null.decorator.js';
import { IsResidentIdList } from './resident-ids.decorator.js';

/** Omitted fields keep their value; `detail: null` clears it. */
export class UpdateActivityDto {
  @ApiPropertyOptional({ enum: ActivityType, enumName: 'ActivityType' })
  @IsOptionalNotNull()
  @IsEnum(ActivityType)
  type?: ActivityType;

  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title?: string;

  @IsOptionalNotNull()
  @IsDateTimeWithOffset()
  scheduledTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  detail?: string | null;

  /** Replaces the participants. */
  @IsOptionalNotNull()
  @IsResidentIdList()
  residentIds?: string[];
}
