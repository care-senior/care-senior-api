import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFeedbackDto {
  /** Rating of the app, from 1 to 5. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  /** Suggestions, praise or problems. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;
}
