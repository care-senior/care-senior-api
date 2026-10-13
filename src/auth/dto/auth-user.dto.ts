import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StaffRole, UserRole } from '../../common/enums/index.js';

export class AuthUserDto {
  id!: string;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  userRole!: UserRole;

  name!: string;

  email!: string;

  photoPath?: string | null;

  @ApiPropertyOptional({ enum: StaffRole, enumName: 'StaffRole' })
  staffRole?: StaffRole;

  clinicId?: string;
}
