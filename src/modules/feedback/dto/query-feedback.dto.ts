import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { UserRole } from '../../../common/enums/index.js';

export class QueryFeedbackDto extends PaginationQueryDto {
  /** Must be the caller's own clinic when sent. */
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  @ApiPropertyOptional({ enum: UserRole, enumName: 'UserRole' })
  @IsOptional()
  @IsEnum(UserRole)
  authorRole?: UserRole;
}
