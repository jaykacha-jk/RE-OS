import { SetMetadata } from '@nestjs/common';

import { AUTH_ONLY_KEY } from '../constants/rbac.constants';

/** Marks a route as authenticated-only (no explicit permission string required). */
export const AuthOnly = () => SetMetadata(AUTH_ONLY_KEY, true);
