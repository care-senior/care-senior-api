import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class QueryPendingLinkRequestsDto extends PaginationQueryDto {
  /** Must be the clinic of the logged-in staff member when sent. */
  @IsOptional()
  @IsUUID()
  clinicId?: string;
}
