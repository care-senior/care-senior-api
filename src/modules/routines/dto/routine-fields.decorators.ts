import { applyDecorators } from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsUUID,
  Matches,
} from 'class-validator';
import { Weekday } from '../../../common/enums/index.js';

export const IsRoutineTime = () =>
  Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'time must be HH:mm' });

export const IsWeekdayList = () =>
  applyDecorators(
    IsArray(),
    ArrayMinSize(1),
    ArrayUnique(),
    IsEnum(Weekday, { each: true }),
  );

export const IsRoomIdList = () =>
  applyDecorators(
    IsArray(),
    ArrayMinSize(1),
    ArrayMaxSize(50),
    ArrayUnique(),
    IsUUID(undefined, { each: true }),
  );
