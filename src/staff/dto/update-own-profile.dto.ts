import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsCpf } from '../../common/validators/cpf.decorator.js';

export class UpdateOwnProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsCpf()
  cpf?: string;
}
