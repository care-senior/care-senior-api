import { SetMetadata } from '@nestjs/common';
import type { StaffRole, UserRole } from '../../common/enums/index.js';

export const USER_ROLES_KEY = 'userRoles';
export const STAFF_ROLES_KEY = 'staffRoles';

export const Roles = (...roles: UserRole[]) =>
  SetMetadata(USER_ROLES_KEY, roles);

export const StaffRoles = (...roles: StaffRole[]) =>
  SetMetadata(STAFF_ROLES_KEY, roles);
