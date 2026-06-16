import { SetMetadata } from '@nestjs/common';

import { REQUIRE_FEATURE_KEY } from '../constants/rbac.constants';

export const RequireFeature = (feature: string) => SetMetadata(REQUIRE_FEATURE_KEY, feature);
