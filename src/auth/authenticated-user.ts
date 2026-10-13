import type { StaffRole, UserRole } from '../common/enums/index.js';

export interface AuthenticatedUser {
  id: string;
  userRole: UserRole;
  sessionId: string;
  staffRole?: StaffRole;
  clinicId?: string;
}
