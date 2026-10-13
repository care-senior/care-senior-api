import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StaffRole, UserRole } from '../../../common/enums/index.js';
import type { Account } from '../services/accounts.service.js';

export class AuthUserDto {
  id!: string;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role!: UserRole;

  name!: string;

  email!: string;

  photoPath?: string | null;

  @ApiPropertyOptional({ enum: StaffRole, enumName: 'StaffRole' })
  staffRole?: StaffRole;

  clinicId?: string;

  static fromAccount(account: Account): AuthUserDto {
    const dto = new AuthUserDto();
    dto.id = account.id;
    dto.role = account.role;
    dto.name = account.name;
    dto.email = account.email;
    dto.photoPath = account.photoPath;
    dto.staffRole = account.staffRole;
    dto.clinicId = account.clinicId;
    return dto;
  }
}
