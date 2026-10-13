import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class QueryMedicationsDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  residentId?: string;

  /** Staff: must be their own clinic when sent. */
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  /** `true` for treatments in progress, `false` for the ended ones; both when omitted. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  active?: boolean;
}
