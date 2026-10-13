import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class QueryResidentsDto extends PaginationQueryDto {
  /** Staff: must be their own clinic when sent. */
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  /** Guardians: must be themself when sent. */
  @IsOptional()
  @IsUUID()
  guardianId?: string;

  /** Matches part of the resident name, case-insensitive. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;
}
