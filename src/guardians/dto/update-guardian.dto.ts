import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { NormalizeEmail } from '../../auth/dto/email.transform.js';
import { IsCpf } from '../../common/validators/cpf.decorator.js';

export class UpdateGuardianDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsCpf()
  cpf?: string;
}
