import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { IsDateTimeWithOffset } from '../../../common/validators/date-time-with-offset.decorator.js';

export class QueryActivitiesDto extends PaginationQueryDto {
  /** Staff: must be their own clinic when sent. */
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  /** Guardians: must be one of their residents. */
  @IsOptional()
  @IsUUID()
  residentId?: string;

  /** Scheduled at or after this moment. */
  @IsOptional()
  @IsDateTimeWithOffset()
  from?: string;

  /** Scheduled before this moment. */
  @IsOptional()
  @IsDateTimeWithOffset()
  to?: string;
}
