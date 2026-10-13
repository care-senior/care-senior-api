import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import {
  ActivityType,
  RoutineScope,
  Weekday,
} from '../../../common/enums/index.js';
import type { Routine } from '../entities/routine.entity.js';

const WEEK_ORDER = Object.values(Weekday);

export class RoutineResidentDto {
  id!: string;

  name!: string;
}

export class RoutineRoomDto {
  id!: string;

  number!: string;
}

export class RoutineResponseDto {
  id!: string;

  clinicId!: string;

  title!: string;

  @ApiProperty({ enum: ActivityType, enumName: 'ActivityType' })
  activityType!: ActivityType;

  /** `HH:mm`, Brasília time. */
  time!: string;

  /** Monday first. */
  @ApiProperty({ enum: Weekday, enumName: 'Weekday', isArray: true })
  weekdays!: Weekday[];

  @ApiProperty({ enum: RoutineScope, enumName: 'RoutineScope' })
  scope!: RoutineScope;

  /** Only with `specificResidents`, by name. */
  residents!: RoutineResidentDto[];

  /** Only with `specificRoom`, by number. */
  rooms!: RoutineRoomDto[];

  instructions!: string | null;

  /** A paused routine generates no activities. */
  active!: boolean;

  /** `residents` and `rooms` come from relations, so load them first. */
  static fromEntity(routine: Routine): RoutineResponseDto {
    const dto = new RoutineResponseDto();
    dto.id = routine.id;
    dto.clinicId = routine.clinicId;
    dto.title = routine.title;
    dto.activityType = routine.activityType;
    dto.time = routine.time;
    dto.weekdays = [...routine.weekdays].sort(
      (first, second) => WEEK_ORDER.indexOf(first) - WEEK_ORDER.indexOf(second),
    );
    dto.scope = routine.scope;
    dto.residents = (routine.residents ?? [])
      .map(({ id, name }) => ({ id, name }))
      .sort((first, second) => first.name.localeCompare(second.name));
    dto.rooms = (routine.rooms ?? [])
      .map(({ id, number }) => ({ id, number }))
      .sort((first, second) => first.number.localeCompare(second.number));
    dto.instructions = routine.instructions ?? null;
    dto.active = routine.active;
    return dto;
  }
}

export class RoutinePageDto extends PaginatedResponseDto(RoutineResponseDto) {}
