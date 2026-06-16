import { Module } from '@nestjs/common';

import { FeatureFlagGuard } from './guards/feature-flag.guard';
import { SettingsModule } from '../modules/settings/settings.module';

/**
 * Shared feature-flag enforcement for bounded contexts.
 * Import this module wherever @RequireFeature() is used on controllers.
 */
@Module({
  imports: [SettingsModule],
  providers: [FeatureFlagGuard],
  exports: [FeatureFlagGuard, SettingsModule],
})
export class FeatureFlagsModule {}
