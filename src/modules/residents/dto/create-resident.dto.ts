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
import { ResidentMood } from '../../../common/enums/index.js';

export class CreateResidentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsInt()
  @Min(0)
  @Max(130)
  age!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  healthNotes?: string;

  @ApiPropertyOptional({ enum: ResidentMood, enumName: 'ResidentMood' })
  @IsOptional()
  @IsEnum(ResidentMood)
  mood?: ResidentMood;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  peculiarities?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  emergencyContactPhone?: string;
}
