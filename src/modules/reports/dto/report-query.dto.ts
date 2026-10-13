import { IsOptional, IsUUID } from 'class-validator';
import { IsDateTimeWithOffset } from '../../../common/validators/date-time-with-offset.decorator.js';

export class ReportQueryDto {
  /** Must be your own clinic when sent. */
  @IsOptional()
  @IsUUID()
  clinicId?: string;
}

/** Defaults to the last 30 days; at most 366 days. */
export class ReportPeriodQueryDto extends ReportQueryDto {
  /** ISO 8601 with offset; defaults to 30 days before `to`. */
  @IsOptional()
  @IsDateTimeWithOffset()
  from?: string;

  /** ISO 8601 with offset; defaults to now. */
  @IsOptional()
  @IsDateTimeWithOffset()
  to?: string;
}
