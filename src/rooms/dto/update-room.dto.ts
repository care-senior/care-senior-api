import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsOptionalNotNull } from '../../common/validators/optional-not-null.decorator.js';

/** Omitted fields keep their value; `wing: null` clears the wing. */
export class UpdateRoomDto {
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  number?: string;

  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  floor?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  wing?: string | null;

  /** Can't go below the number of residents in the room. */
  @IsOptionalNotNull()
  @IsInt()
  @Min(1)
  @Max(20)
  capacity?: number;
}
