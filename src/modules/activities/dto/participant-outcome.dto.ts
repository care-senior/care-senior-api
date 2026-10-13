import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsResidentIdList } from './resident-ids.decorator.js';

/** Visible to the guardians, without saying who of the staff wrote it. */
export class CompleteParticipantDto {
  /** How it went for the resident, from 1 to 5. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

/** The reason is visible to the guardians. */
export class SkipParticipantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class CompleteParticipantsDto extends CompleteParticipantDto {
  @IsResidentIdList()
  residentIds!: string[];
}

export class SkipParticipantsDto extends SkipParticipantDto {
  @IsResidentIdList()
  residentIds!: string[];
}

/** The reason is visible to the guardians. */
export class CancelActivityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
