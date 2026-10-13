import { ApiProperty } from '@nestjs/swagger';
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
import { IsResidentIdList } from '../../activities/dto/resident-ids.decorator.js';
import {
  IsRoomIdList,
  IsRoutineTime,
  IsWeekdayList,
} from './routine-fields.decorators.js';

export class CreateRoutineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @ApiProperty({ enum: ActivityType, enumName: 'ActivityType' })
  @IsEnum(ActivityType)
  activityType!: ActivityType;

  /** `HH:mm`, Brasília time. */
  @IsRoutineTime()
  time!: string;

  @ApiProperty({ enum: Weekday, enumName: 'Weekday', isArray: true })
  @IsWeekdayList()
  weekdays!: Weekday[];

  @ApiProperty({ enum: RoutineScope, enumName: 'RoutineScope' })
  @IsEnum(RoutineScope)
  scope!: RoutineScope;

  /** Required with `specificResidents`; residents of your clinic. */
  @IsOptional()
  @IsResidentIdList()
  residentIds?: string[];

  /** Required with `specificRoom`; rooms of your clinic. */
  @IsOptional()
  @IsRoomIdList()
  roomIds?: string[];

  /** Becomes the `detail` of every generated activity. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;
}
