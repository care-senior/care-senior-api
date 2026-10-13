import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { HealthRecordType } from '../../../common/enums/index.js';
import { IsDateTimeWithOffset } from '../../../common/validators/date-time-with-offset.decorator.js';

export class QueryHealthRecordsDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  residentId?: string;

  /** Staff: must be their own clinic when sent. */
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  @ApiPropertyOptional({ enum: HealthRecordType, enumName: 'HealthRecordType' })
  @IsOptional()
  @IsEnum(HealthRecordType)
  type?: HealthRecordType;

  /** Recorded at or after this moment. */
  @IsOptional()
  @IsDateTimeWithOffset()
  from?: string;

  /** Recorded before this moment. */
  @IsOptional()
  @IsDateTimeWithOffset()
  to?: string;
}
