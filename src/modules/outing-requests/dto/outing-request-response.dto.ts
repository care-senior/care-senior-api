import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { OutingRequestStatus } from '../../../common/enums/index.js';
import type { OutingRequest } from '../entities/outing-request.entity.js';

export class OutingRequestResponseDto {
  id!: string;

  residentId!: string;

  residentName!: string;

  /** Who asked for the outing. */
  guardianId!: string;

  guardianName!: string;

  departureAt!: Date;

  returnAt!: Date;

  notes!: string | null;

  @ApiProperty({ enum: OutingRequestStatus, enumName: 'OutingRequestStatus' })
  status!: OutingRequestStatus;

  createdAt!: Date;

  /** When the clinic approved or rejected it. */
  respondedAt!: Date | null;

  /** Only when rejected; visible to the guardians. */
  rejectionReason!: string | null;

  /** `resident` and `guardian` come from relations, so load them first. */
  static fromEntity(entity: OutingRequest): OutingRequestResponseDto {
    const dto = new OutingRequestResponseDto();
    dto.id = entity.id;
    dto.residentId = entity.residentId;
    dto.residentName = entity.resident.name;
    dto.guardianId = entity.guardianId;
    dto.guardianName = entity.guardian.name;
    dto.departureAt = entity.departureAt;
    dto.returnAt = entity.returnAt;
    dto.notes = entity.notes ?? null;
    dto.status = entity.status;
    dto.createdAt = entity.createdAt;
    dto.respondedAt = entity.respondedAt ?? null;
    dto.rejectionReason = entity.rejectionReason ?? null;
    return dto;
  }
}

export class OutingRequestPageDto extends PaginatedResponseDto(
  OutingRequestResponseDto,
) {}
