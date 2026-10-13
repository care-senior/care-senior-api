import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { StaffRole } from '../../../common/enums/index.js';
import { maskCpf } from '../../../common/utils/cpf.js';
import type { StaffMember } from '../entities/staff-member.entity.js';

export class StaffResponseDto {
  id!: string;

  name!: string;

  email!: string;

  @ApiProperty({ enum: StaffRole, enumName: 'StaffRole' })
  staffRole!: StaffRole;

  clinicId!: string;

  photoPath?: string | null;

  /** Only the check digits are visible (`•••.•••.•••-09`); null when not informed. */
  maskedCpf!: string | null;

  createdAt!: Date;

  /** Set when the staff member was deactivated; they can no longer log in. */
  deactivatedAt!: Date | null;

  static fromEntity(staffMember: StaffMember): StaffResponseDto {
    const dto = new StaffResponseDto();
    dto.id = staffMember.id;
    dto.name = staffMember.name;
    dto.email = staffMember.email;
    dto.staffRole = staffMember.staffRole;
    dto.clinicId = staffMember.clinicId;
    dto.photoPath = staffMember.photoPath ?? null;
    dto.maskedCpf = maskCpf(staffMember.cpf);
    dto.createdAt = staffMember.createdAt;
    dto.deactivatedAt = staffMember.deactivatedAt ?? null;
    return dto;
  }
}

export class StaffPageDto extends PaginatedResponseDto(StaffResponseDto) {}
