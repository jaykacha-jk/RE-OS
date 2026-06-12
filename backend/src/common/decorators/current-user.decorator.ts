import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthUser } from '../context/auth-user';

export const CurrentUser = createParamDecorator((_, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.user as AuthUser;
});

