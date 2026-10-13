import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StaffRole, UserRole } from '../../common/enums/index.js';
import type { AuthenticatedUser } from '../authenticated-user.js';
import {
  STAFF_ROLES_KEY,
  USER_ROLES_KEY,
} from '../decorators/roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

function contextFor(
  user: AuthenticatedUser | undefined,
  metadata: Record<string, unknown>,
): ExecutionContext {
  const handler = () => undefined;
  for (const [key, value] of Object.entries(metadata)) {
    Reflect.defineMetadata(key, value, handler);
  }
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const nurse: AuthenticatedUser = {
  id: 'staff-id',
  userRole: UserRole.STAFF,
  sessionId: 'session-id',
  staffRole: StaffRole.NURSE,
  clinicId: 'clinic-id',
};
const guardian: AuthenticatedUser = {
  id: 'guardian-id',
  userRole: UserRole.GUARDIAN,
  sessionId: 'session-id',
};

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('allows routes without role metadata', () => {
    expect(guard.canActivate(contextFor(guardian, {}))).toBe(true);
  });

  it('checks the user role', () => {
    const staffOnly = { [USER_ROLES_KEY]: [UserRole.STAFF] };

    expect(guard.canActivate(contextFor(nurse, staffOnly))).toBe(true);
    expect(() => guard.canActivate(contextFor(guardian, staffOnly))).toThrow(
      ForbiddenException,
    );
  });

  it('checks the staff role and refuses guardians', () => {
    const managersOnly = {
      [STAFF_ROLES_KEY]: [StaffRole.COORDINATOR, StaffRole.NURSE],
    };
    const caregiver = { ...nurse, staffRole: StaffRole.CAREGIVER };

    expect(guard.canActivate(contextFor(nurse, managersOnly))).toBe(true);
    expect(() =>
      guard.canActivate(contextFor(caregiver, managersOnly)),
    ).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor(guardian, managersOnly))).toThrow(
      ForbiddenException,
    );
  });
});
