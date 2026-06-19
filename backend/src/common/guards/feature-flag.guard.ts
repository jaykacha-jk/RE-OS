import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { REQUIRE_FEATURE_KEY } from '../constants/rbac.constants';
import { FeatureFlagsService } from '../../modules/settings/feature-flags.service';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly features: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<string>(REQUIRE_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return true;

    const req = context.switchToHttp().getRequest();
    const tenantId =
      (req.tenant as { tenantId?: string } | undefined)?.tenantId ??
      (req.user?.tenantId as string | null | undefined);
    if (!tenantId) {
      throw new ForbiddenException({
        code: 'FEATURE_TENANT_REQUIRED',
        message: `Feature "${feature}" requires tenant context`,
      });
    }

    const enabled = await this.features.isEnabled(tenantId, feature);
    if (!enabled) {
      throw new ForbiddenException({
        code: 'FEATURE_DISABLED',
        message: `Feature "${feature}" is disabled for this organization`,
      });
    }
    return true;
  }
}
