import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { OutingRequestStatus } from '../../../common/enums/index.js';

export class QueryOutingRequestsDto extends PaginationQueryDto {
  /** Guardians: must be one of their residents. */
  @IsOptional()
  @IsUUID()
  residentId?: string;

  /** Staff: must be their own clinic when sent. */
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  @ApiPropertyOptional({
    enum: OutingRequestStatus,
    enumName: 'OutingRequestStatus',
  })
  @IsOptional()
  @IsEnum(OutingRequestStatus)
  status?: OutingRequestStatus;

  /** Matches part of the resident or guardian name, case-insensitive. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;
}
