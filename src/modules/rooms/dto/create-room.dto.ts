import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRoomDto {
  /** Unique within the clinic, e.g. `12B`. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  number!: string;

  /** Free text, e.g. `Térreo` or `1º andar`. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  floor!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  wing?: string;

  /** Number of beds. */
  @IsInt()
  @Min(1)
  @Max(20)
  capacity!: number;
}
