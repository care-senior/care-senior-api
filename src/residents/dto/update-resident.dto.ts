import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ResidentMood } from '../../common/enums/index.js';
import { IsOptionalNotNull } from '../../common/validators/optional-not-null.decorator.js';

/** Omitted fields keep their value; `null` clears an optional field. */
export class UpdateResidentDto {
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptionalNotNull()
  @IsInt()
  @Min(0)
  @Max(130)
  age?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  healthNotes?: string | null;

  @ApiPropertyOptional({
    enum: ResidentMood,
    enumName: 'ResidentMood',
    nullable: true,
  })
  @IsOptional()
  @IsEnum(ResidentMood)
  mood?: ResidentMood | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  peculiarities?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  emergencyContactName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  emergencyContactPhone?: string | null;
}
