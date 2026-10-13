import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsDateTimeWithOffset } from '../../../common/validators/date-time-with-offset.decorator.js';

export class CreateOutingRequestDto {
  /** A resident of the guardian, linked to a clinic. */
  @IsUUID()
  residentId!: string;

  /** In the future. */
  @IsDateTimeWithOffset()
  departureAt!: string;

  /** Expected return, after `departureAt`. */
  @IsDateTimeWithOffset()
  returnAt!: string;

  /** Destination, medication to take along, contact during the outing. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
