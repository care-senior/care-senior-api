import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { NormalizeEmail } from '../../auth/dto/email.transform.js';
import { StaffRole } from '../../common/enums/index.js';
import { IsCpf } from '../../common/validators/cpf.decorator.js';

export class CreateStaffDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ enum: StaffRole, enumName: 'StaffRole' })
  @IsEnum(StaffRole)
  staffRole!: StaffRole;

  /** With or without punctuation; validated by its check digits. */
  @IsOptional()
  @IsCpf()
  cpf?: string;
}
