import { Injectable } from '@nestjs/common';

import { DEFAULT_CONFIGURATION } from './settings.constants';
import { SettingsService } from './settings.service';

export type TenantConfiguration = {
  timezone: string;
  currency: string;
  language: string;
  date_format: string;
  number_format: string;
  business_hours: Record<string, unknown>;
};

/**
 * Central configuration access point for the platform. Any module needing a
 * tenant's timezone, currency, locale or business hours should resolve them
 * here rather than reading raw rows — keeping a single, cached source of truth
 * (ARCHITECTURE: no shared mutable global state for tenant context).
 */
@Injectable()
export class TenantConfigService {
  constructor(private readonly settings: SettingsService) {}

  async getConfiguration(tenantId: string): Promise<TenantConfiguration> {
    const cfg = (await this.settings.getCategory(tenantId, 'configuration')) as Record<string, unknown>;
    return {
      timezone: (cfg.timezone as string) ?? DEFAULT_CONFIGURATION.timezone,
      currency: (cfg.currency as string) ?? DEFAULT_CONFIGURATION.currency,
      language: (cfg.language as string) ?? DEFAULT_CONFIGURATION.language,
      date_format: (cfg.date_format as string) ?? DEFAULT_CONFIGURATION.date_format,
      number_format: (cfg.number_format as string) ?? DEFAULT_CONFIGURATION.number_format,
      business_hours: (cfg.business_hours as Record<string, unknown>) ?? DEFAULT_CONFIGURATION.business_hours,
    };
  }

  async getTimezone(tenantId: string): Promise<string> {
    return (await this.getConfiguration(tenantId)).timezone;
  }

  async getCurrency(tenantId: string): Promise<string> {
    return (await this.getConfiguration(tenantId)).currency;
  }
}
