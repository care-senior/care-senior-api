import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { NormalizeEmail } from '../../auth/dto/email.transform.js';
import { IsCpf } from '../../../common/validators/cpf.decorator.js';
import { CreateResidentDto } from '../../residents/dto/create-resident.dto.js';

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

export class WalkInResidentDto extends CreateResidentDto {
  /** A room of the caller clinic with a free bed. */
  @IsUUID()
  roomId!: string;
}

export class CreateGuardianDto {
  @ValidateNested()
  @Type(() => WalkInGuardianDto)
  guardian!: WalkInGuardianDto;

  @ValidateNested()
  @Type(() => WalkInResidentDto)
  resident!: WalkInResidentDto;
}
