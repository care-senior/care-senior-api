import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { RoomStatus } from '../room-status.enum.js';

export class QueryRoomsDto extends PaginationQueryDto {
  /** Must be the clinic of the logged-in staff member when sent. */
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  /** `vacant`: at least one free bed. `occupied`: every bed taken. */
  @ApiPropertyOptional({ enum: RoomStatus, enumName: 'RoomStatus' })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;
}
