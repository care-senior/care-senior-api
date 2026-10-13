import type { StaffMember } from '../entities/staff-member.entity.js';

/** Who of the staff did something; only ever sent to staff members. */
export class StaffSummaryDto {
  id!: string;

  name!: string;

  static fromEntity({ id, name }: Pick<StaffMember, 'id' | 'name'>) {
    const dto = new StaffSummaryDto();
    dto.id = id;
    dto.name = name;
    return dto;
  }
}
