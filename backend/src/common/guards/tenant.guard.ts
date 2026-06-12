import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { AuthUser } from '../context/auth-user';
import type { TenantContext } from '../context/tenant-context';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;

    if (!user?.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    const tenant: TenantContext = { tenantId: user.tenantId };
    req.tenant = tenant;
    return true;
  }
}
