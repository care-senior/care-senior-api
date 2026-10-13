import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { NormalizeEmail } from '../../auth/dto/email.transform.js';
import { StaffRole } from '../../../common/enums/index.js';
import { IsCpf } from '../../../common/validators/cpf.decorator.js';
import { IsOptionalNotNull } from '../../../common/validators/optional-not-null.decorator.js';

export class UpdateStaffDto {
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

  @ApiPropertyOptional({ enum: StaffRole, enumName: 'StaffRole' })
  @IsOptionalNotNull()
  @IsEnum(StaffRole)
  staffRole?: StaffRole;

  @IsOptional()
  @IsCpf()
  cpf?: string;
}
