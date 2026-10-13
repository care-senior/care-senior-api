import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MedicationForm } from '../../../common/enums/index.js';
import { IsDateTimeWithOffset } from '../../../common/validators/date-time-with-offset.decorator.js';

export class CreateMedicationDto {
  @IsUUID()
  residentId!: string;

  /** E.g. `Losartana`. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  /** E.g. `50mg`. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  dosage!: string;

  @ApiProperty({ enum: MedicationForm, enumName: 'MedicationForm' })
  @IsEnum(MedicationForm)
  form!: MedicationForm;

  /** Free text, e.g. `A cada 8 horas`. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  frequency!: string;

  /** E.g. `Tomar em jejum`. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  prescribedBy?: string;

  /** Defaults to now. */
  @IsOptional()
  @IsDateTimeWithOffset()
  startDate?: string;

  /** Leave it out for a continuous treatment. */
  @IsOptional()
  @IsDateTimeWithOffset()
  endDate?: string;
}
