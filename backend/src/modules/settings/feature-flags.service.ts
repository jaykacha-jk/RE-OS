import { Injectable } from '@nestjs/common';

import { DEFAULT_FEATURES } from './settings.constants';
import { SettingsService } from './settings.service';

/**
 * Central, database-backed feature flag resolver. Other modules inject this to
 * gate behaviour per tenant — flags are NEVER hard-coded (SaaS rule). Values are
 * resolved through SettingsService (cached) and merged over DEFAULT_FEATURES so
 * an unknown/unset flag falls back to its platform default.
 */
@Injectable()
export class FeatureFlagsService {
  constructor(private readonly settings: SettingsService) {}

  async getFlags(tenantId: string): Promise<Record<string, boolean>> {
    const flags = (await this.settings.getCategory(tenantId, 'features')) as Record<string, unknown>;
    const resolved: Record<string, boolean> = {};
    for (const key of Object.keys(DEFAULT_FEATURES)) {
      resolved[key] = typeof flags[key] === 'boolean' ? (flags[key] as boolean) : DEFAULT_FEATURES[key];
    }
    return resolved;
  }

  async isEnabled(tenantId: string, feature: string): Promise<boolean> {
    const flags = await this.getFlags(tenantId);
    return flags[feature] ?? false;
  }
}
