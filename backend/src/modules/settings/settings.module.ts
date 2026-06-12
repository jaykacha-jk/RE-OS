import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';
import { FeatureFlagsService } from './feature-flags.service';
import { PublicSettingsController } from './public-settings.controller';
import { SettingsCacheService } from './settings-cache.service';
import { SettingsController } from './settings.controller';
import { SettingsRepository } from './settings.repository';
import { SettingsService } from './settings.service';
import { TenantConfigService } from './tenant-config.service';

/**
 * Phase 9 — Enterprise + White Label Platform.
 *
 * Central tenant-configuration surface. Exports SettingsService,
 * FeatureFlagsService and TenantConfigService so any other bounded context can
 * resolve a tenant's settings, feature flags and locale through a single,
 * cached source of truth (no hard-coded flags; no cross-module repo imports).
 */
@Module({
  imports: [AuditModule],
  controllers: [SettingsController, DomainsController, PublicSettingsController],
  providers: [
    SettingsService,
    SettingsRepository,
    SettingsCacheService,
    FeatureFlagsService,
    TenantConfigService,
    DomainsService,
  ],
  exports: [SettingsService, FeatureFlagsService, TenantConfigService],
})
export class SettingsModule {}
