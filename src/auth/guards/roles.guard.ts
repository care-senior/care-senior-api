import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { StaffRole, UserRole } from '../../common/enums/index.js';
import type { AuthenticatedUser } from '../authenticated-user.js';
import {
  STAFF_ROLES_KEY,
  USER_ROLES_KEY,
} from '../decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const userRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      USER_ROLES_KEY,
      targets,
    );
    const staffRoles = this.reflector.getAllAndOverride<
      StaffRole[] | undefined
    >(STAFF_ROLES_KEY, targets);
    if (!userRoles && !staffRoles) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    if (!user) throw new ForbiddenException();

    if (userRoles && !userRoles.includes(user.userRole)) {
      throw new ForbiddenException();
    }
    if (
      staffRoles &&
      (user.userRole !== UserRole.STAFF ||
        !user.staffRole ||
        !staffRoles.includes(user.staffRole))
    ) {
      throw new ForbiddenException();
    }
    return true;
  }
}
