import { SetMetadata } from '@nestjs/common';
import type { StaffRole } from '../enums/index.js';

export const ROLES_KEY = 'roles';

export const Roles = (
  ...roles: StaffRole[]
): MethodDecorator & ClassDecorator => SetMetadata(ROLES_KEY, roles);
