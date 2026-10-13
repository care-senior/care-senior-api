import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { StaffRole } from '../../common/enums/index.js';

export class QueryStaffDto extends PaginationQueryDto {
  /** Must be the clinic of the logged-in staff member when sent. */
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  /** Matches part of the name or e-mail, case-insensitive. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: StaffRole, enumName: 'StaffRole' })
  @IsOptional()
  @IsEnum(StaffRole)
  staffRole?: StaffRole;

  /** Deactivated staff members are left out unless this is `true`. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  includeInactive: boolean = false;
}
