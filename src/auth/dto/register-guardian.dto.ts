import { Type } from 'class-transformer';
import {
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { WalkInGuardianDto } from '../../guardians/dto/create-guardian.dto.js';
import { CreateResidentDto } from '../../residents/dto/create-resident.dto.js';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from './reset-password.dto.js';

export class GuardianSignupDto extends WalkInGuardianDto {
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}

/** The guardian account and the resident they look after, not linked to any clinic yet. */
export class RegisterGuardianDto {
  @ValidateNested()
  @Type(() => GuardianSignupDto)
  guardian!: GuardianSignupDto;

  @ValidateNested()
  @Type(() => CreateResidentDto)
  resident!: CreateResidentDto;
}
