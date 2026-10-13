import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NormalizeEmail } from '../../auth/dto/email.transform.js';
import { IsCpf } from '../../../common/validators/cpf.decorator.js';
import { IsOptionalNotNull } from '../../../common/validators/optional-not-null.decorator.js';

export class UpdateGuardianDto {
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptionalNotNull()
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptionalNotNull()
  @IsCpf()
  cpf?: string;
}
