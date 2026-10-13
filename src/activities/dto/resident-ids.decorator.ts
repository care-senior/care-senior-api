import { applyDecorators } from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';

export const MAX_PARTICIPANTS = 200;

export const IsResidentIdList = () =>
  applyDecorators(
    IsArray(),
    ArrayMinSize(1),
    ArrayMaxSize(MAX_PARTICIPANTS),
    ArrayUnique(),
    IsUUID(undefined, { each: true }),
  );
