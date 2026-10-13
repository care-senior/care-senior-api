import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { ResidentResponseDto } from '../../residents/dto/resident-response.dto.js';
import { GuardianResponseDto } from './guardian-response.dto.js';

/** A guardian who contacted the clinic, with their residents not linked to any clinic yet. */
export class PendingLinkRequestDto {
  guardian!: GuardianResponseDto;

  @ApiProperty({ type: [ResidentResponseDto] })
  residents!: ResidentResponseDto[];
}

export class PendingLinkRequestPageDto extends PaginatedResponseDto(
  PendingLinkRequestDto,
) {}
