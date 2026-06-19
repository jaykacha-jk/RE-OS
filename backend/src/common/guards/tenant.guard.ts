import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import type { AuthUser } from '../context/auth-user';
import type { TenantContext } from '../context/tenant-context';

const IMPERSONATE_PERMISSION = 'platform.impersonate';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;

    const headerTenantId = this.readTenantHeader(req.headers);
    if (user?.roles?.includes('super_admin') && headerTenantId) {
      if (!user.permissions?.includes(IMPERSONATE_PERMISSION)) {
        throw new ForbiddenException('Missing platform.impersonate permission');
      }

      const org = await this.prisma.dbClient.organizations.findFirst({
        where: { id: headerTenantId, deleted_at: null },
        select: { id: true },
      });
      if (!org) {
        throw new ForbiddenException('Invalid impersonation tenant');
      }

      const tenant: TenantContext = {
        tenantId: headerTenantId,
        impersonated: true,
        impersonatorUserId: user.userId,
      };
      req.tenant = tenant;
      return true;
    }

    if (!user?.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    const tenant: TenantContext = { tenantId: user.tenantId };
    req.tenant = tenant;
    return true;
  }

  private readTenantHeader(headers: Record<string, unknown>): string | undefined {
    const raw = headers['x-tenant-id'];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0].trim()) {
      return raw[0].trim();
    }
    return undefined;
  }
}
