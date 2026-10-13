import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ActivityType,
  RoutineScope,
  Weekday,
} from '../../../common/enums/index.js';
import { IsOptionalNotNull } from '../../../common/validators/optional-not-null.decorator.js';
import { IsResidentIdList } from '../../activities/dto/resident-ids.decorator.js';
import {
  IsRoomIdList,
  IsRoutineTime,
  IsWeekdayList,
} from './routine-fields.decorators.js';

/**
 * Omitted fields keep their value; `instructions: null` clears it. Changing
 * `scope` to `specificResidents` or `specificRoom` needs the new list too.
 */
export class UpdateRoutineDto {
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional({ enum: ActivityType, enumName: 'ActivityType' })
  @IsOptionalNotNull()
  @IsEnum(ActivityType)
  activityType?: ActivityType;

  /** `HH:mm`, Brasília time. */
  @IsOptionalNotNull()
  @IsRoutineTime()
  time?: string;

  @ApiPropertyOptional({ enum: Weekday, enumName: 'Weekday', isArray: true })
  @IsOptionalNotNull()
  @IsWeekdayList()
  weekdays?: Weekday[];

  @ApiPropertyOptional({ enum: RoutineScope, enumName: 'RoutineScope' })
  @IsOptionalNotNull()
  @IsEnum(RoutineScope)
  scope?: RoutineScope;

  /** Replaces the residents; only with `specificResidents`. */
  @IsOptionalNotNull()
  @IsResidentIdList()
  residentIds?: string[];

  /** Replaces the rooms; only with `specificRoom`. */
  @IsOptionalNotNull()
  @IsRoomIdList()
  roomIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string | null;
}
