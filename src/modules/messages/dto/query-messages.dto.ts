import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class QueryMessagesDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  residentId?: string;
}
