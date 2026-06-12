import {
  CanActivate,
  ForbiddenException,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthUser } from '../context/auth-user';
import { REQUIRE_PERMISSIONS_KEY } from '../constants/rbac.constants';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions: string[] =
      this.reflector.getAllAndOverride<string[]>(REQUIRE_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    // No decorator => public route for authz purposes
    if (requiredPermissions.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;

    if (!user) throw new ForbiddenException('Missing authenticated user');

    // Super admin shortcut (token roles).
    if (user.roles.includes('super_admin')) return true;

    const hasAll = requiredPermissions.every((perm) =>
      user.permissions.includes(perm),
    );

    if (!hasAll) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}

