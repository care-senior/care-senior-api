import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsOptionalNotNull } from '../../common/validators/optional-not-null.decorator.js';

export class UpdateClinicDto {
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address?: string;

  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone?: string;

  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  operatingHours?: string;

  @IsOptionalNotNull()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  activities?: string[];

  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  responsiblePeople?: string;

  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  whatsappPhone?: string;

  @IsOptionalNotNull()
  @IsLatitude()
  latitude?: number;

  @IsOptionalNotNull()
  @IsLongitude()
  longitude?: number;
}
