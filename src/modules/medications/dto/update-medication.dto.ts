import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MedicationForm } from '../../../common/enums/index.js';
import { IsDateTimeWithOffset } from '../../../common/validators/date-time-with-offset.decorator.js';
import { IsOptionalNotNull } from '../../../common/validators/optional-not-null.decorator.js';

/** Omitted fields keep their value; `null` clears an optional field (`endDate: null` makes it continuous). */
export class UpdateMedicationDto {
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  dosage?: string;

  @ApiPropertyOptional({ enum: MedicationForm, enumName: 'MedicationForm' })
  @IsOptionalNotNull()
  @IsEnum(MedicationForm)
  form?: MedicationForm;

  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  frequency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  prescribedBy?: string | null;

  @IsOptionalNotNull()
  @IsDateTimeWithOffset()
  startDate?: string;

  @IsOptional()
  @IsDateTimeWithOffset()
  endDate?: string | null;
}
