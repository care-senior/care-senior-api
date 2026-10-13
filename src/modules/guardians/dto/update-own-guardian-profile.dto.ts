import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsCpf } from '../../../common/validators/cpf.decorator.js';
import { IsOptionalNotNull } from '../../../common/validators/optional-not-null.decorator.js';

export class UpdateOwnGuardianProfileDto {
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptionalNotNull()
  @IsCpf()
  cpf?: string;
}
