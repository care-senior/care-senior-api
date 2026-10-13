import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { NormalizeEmail } from '../../auth/dto/email.transform.js';
import { ResidentMood } from '../../common/enums/index.js';
import { IsCpf } from '../../common/validators/cpf.decorator.js';

export class WalkInGuardianDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** With or without punctuation; validated by its check digits. */
  @IsCpf()
  cpf!: string;
}

export class WalkInResidentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsInt()
  @Min(0)
  @Max(130)
  age!: number;

  /** A room of the caller clinic with a free bed. */
  @IsUUID()
  roomId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  healthNotes?: string;

  @ApiPropertyOptional({ enum: ResidentMood, enumName: 'ResidentMood' })
  @IsOptional()
  @IsEnum(ResidentMood)
  mood?: ResidentMood;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  peculiarities?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  emergencyContactPhone?: string;
}

export class CreateGuardianDto {
  @ValidateNested()
  @Type(() => WalkInGuardianDto)
  guardian!: WalkInGuardianDto;

  @ValidateNested()
  @Type(() => WalkInResidentDto)
  resident!: WalkInResidentDto;
}
