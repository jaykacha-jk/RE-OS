import { Injectable } from '@nestjs/common';

import { DEFAULT_CHAT_CONFIGURATION, DEFAULT_CONFIGURATION } from './settings.constants';
import { SettingsService } from './settings.service';

export type TenantChatConfiguration = {
  auto_assign_enabled: boolean;
  auto_assign_delay_minutes: number;
  auto_create_inquiry_on_phone: boolean;
};

export type TenantConfiguration = {
  timezone: string;
  currency: string;
  language: string;
  date_format: string;
  number_format: string;
  chat: TenantChatConfiguration;
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
    const chatRaw = (cfg.chat as Record<string, unknown> | undefined) ?? {};
    return {
      timezone: (cfg.timezone as string) ?? DEFAULT_CONFIGURATION.timezone,
      currency: (cfg.currency as string) ?? DEFAULT_CONFIGURATION.currency,
      language: (cfg.language as string) ?? DEFAULT_CONFIGURATION.language,
      date_format: (cfg.date_format as string) ?? DEFAULT_CONFIGURATION.date_format,
      number_format: (cfg.number_format as string) ?? DEFAULT_CONFIGURATION.number_format,
      chat: {
        auto_assign_enabled:
          (chatRaw.auto_assign_enabled as boolean | undefined) ??
          DEFAULT_CHAT_CONFIGURATION.auto_assign_enabled,
        auto_assign_delay_minutes:
          (chatRaw.auto_assign_delay_minutes as number | undefined) ??
          DEFAULT_CHAT_CONFIGURATION.auto_assign_delay_minutes,
        auto_create_inquiry_on_phone:
          (chatRaw.auto_create_inquiry_on_phone as boolean | undefined) ??
          DEFAULT_CHAT_CONFIGURATION.auto_create_inquiry_on_phone,
      },
      business_hours: (cfg.business_hours as Record<string, unknown>) ?? DEFAULT_CONFIGURATION.business_hours,
    };
  }

  async getChatSettings(tenantId: string): Promise<TenantChatConfiguration> {
    return (await this.getConfiguration(tenantId)).chat;
  }

  async getTimezone(tenantId: string): Promise<string> {
    return (await this.getConfiguration(tenantId)).timezone;
  }

  async getCurrency(tenantId: string): Promise<string> {
    return (await this.getConfiguration(tenantId)).currency;
  }
}
