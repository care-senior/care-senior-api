import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { HealthRecordType, UserRole } from '../../../common/enums/index.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.interface.js';
import { StaffSummaryDto } from '../../staff/dto/staff-summary.dto.js';
import type { HealthRecord } from '../entities/health-record.entity.js';

export class HealthRecordResponseDto {
  id!: string;

  residentId!: string;

  residentName!: string;

  @ApiProperty({ enum: HealthRecordType, enumName: 'HealthRecordType' })
  type!: HealthRecordType;

  value!: string;

  recordedAt!: Date;

  /** Staff member who recorded it. Never sent to guardians. */
  recordedBy?: StaffSummaryDto;

  /** `resident` and `recordedBy` come from relations, so load them first. */
  static fromEntity(
    healthRecord: HealthRecord,
    currentUser: AuthenticatedUser,
  ): HealthRecordResponseDto {
    const dto = new HealthRecordResponseDto();
    dto.id = healthRecord.id;
    dto.residentId = healthRecord.residentId;
    dto.residentName = healthRecord.resident.name;
    dto.type = healthRecord.type;
    dto.value = healthRecord.value;
    dto.recordedAt = healthRecord.recordedAt;
    if (currentUser.role === UserRole.STAFF) {
      dto.recordedBy = StaffSummaryDto.fromEntity(healthRecord.recordedBy);
    }
    return dto;
  }
}

export class HealthRecordPageDto extends PaginatedResponseDto(
  HealthRecordResponseDto,
) {}
