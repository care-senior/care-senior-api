import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ROLES_THAT_MANAGE_REQUESTS,
  StaffRole,
  UserRole,
} from '../enums/index.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../types/authenticated-user.interface.js';
import { RolesGuard } from './roles.guard.js';

function contextFor(
  user: AuthenticatedUser,
  requiredRoles?: StaffRole[],
): ExecutionContext {
  const handler = () => undefined;
  if (requiredRoles) Reflect.defineMetadata(ROLES_KEY, requiredRoles, handler);
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const nurse: AuthenticatedUser = {
  id: 'staff-1',
  role: UserRole.STAFF,
  staffRole: StaffRole.NURSE,
  clinicId: 'clinic-1',
};
const caregiver: AuthenticatedUser = {
  ...nurse,
  staffRole: StaffRole.CAREGIVER,
};
const guardian: AuthenticatedUser = {
  id: 'guardian-1',
  role: UserRole.GUARDIAN,
};

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('deixa passar qualquer usuário autenticado em rota sem @Roles', () => {
    expect(guard.canActivate(contextFor(guardian))).toBe(true);
    expect(guard.canActivate(contextFor(caregiver))).toBe(true);
  });

  it('exige um dos cargos de @Roles', () => {
    expect(
      guard.canActivate(contextFor(nurse, ROLES_THAT_MANAGE_REQUESTS)),
    ).toBe(true);
    expect(
      guard.canActivate(contextFor(caregiver, ROLES_THAT_MANAGE_REQUESTS)),
    ).toBe(false);
  });

  it('recusa responsável em rota com @Roles', () => {
    expect(
      guard.canActivate(contextFor(guardian, ROLES_THAT_MANAGE_REQUESTS)),
    ).toBe(false);
  });
});
