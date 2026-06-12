import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { TenantContext } from '../context/tenant-context';

export const TenantId = createParamDecorator((_, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  const tenant = req.tenant as TenantContext | undefined;
  return tenant?.tenantId;
});

