import type { StaffRole, UserRole } from '../enums/index.js';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  staffRole?: StaffRole;
  clinicId?: string;
}
