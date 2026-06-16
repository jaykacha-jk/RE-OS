import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AuthUser } from '../../common/context/auth-user';
import { AuditService, type AuditRequestMeta } from '../audit/audit.service';
import { SettingsCacheService } from './settings-cache.service';
import { SettingsRepository } from './settings.repository';
import {
  CATEGORY_DEFAULTS,
  SETTINGS_CATEGORIES,
  type SettingsCategory,
} from './settings.constants';

type Json = Record<string, unknown>;

function isPlainObject(value: unknown): value is Json {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Recursively merges `patch` over `base`. Nested plain objects are merged;
 * arrays and scalars are replaced wholesale. `null` explicitly clears a value.
 */
export function deepMerge(base: Json, patch: Json): Json {
  const out: Json = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key] as Json, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly repo: SettingsRepository,
    private readonly cache: SettingsCacheService,
    private readonly audit: AuditService,
  ) {}

  private cacheKey(tenantId: string, category: SettingsCategory) {
    return `settings:${tenantId}:${category}`;
  }

  /** Resolve a single category, merged over its defaults. Cached. */
  async getCategory(tenantId: string, category: SettingsCategory): Promise<Json> {
    return this.cache.wrap(this.cacheKey(tenantId, category), async () => {
      const row = await this.repo.findCategory(tenantId, category);
      const stored = isPlainObject(row?.data) ? (row!.data as Json) : {};
      return deepMerge(CATEGORY_DEFAULTS[category] as Json, stored);
    });
  }

  /** Resolve every settings category for the tenant. */
  async getAll(tenantId: string): Promise<Record<SettingsCategory, Json>> {
    const entries = await Promise.all(
      SETTINGS_CATEGORIES.map(async (category) => [category, await this.getCategory(tenantId, category)] as const),
    );
    return Object.fromEntries(entries) as Record<SettingsCategory, Json>;
  }

  /** Deep-merge a patch into a category, persist, invalidate cache, audit. */
  async updateCategory(
    tenantId: string,
    category: SettingsCategory,
    patch: Json,
    actor: AuthUser,
    meta?: AuditRequestMeta,
  ): Promise<Json> {
    const before = await this.getCategory(tenantId, category);
    const row = await this.repo.findCategory(tenantId, category);
    const stored = isPlainObject(row?.data) ? (row!.data as Json) : {};
    const merged = deepMerge(stored, patch);

    await this.repo.upsertCategory({
      tenantId,
      category,
      data: merged as Prisma.InputJsonValue,
      updatedBy: actor.userId,
    });

    await this.cache.invalidate(`settings:${tenantId}:`);

    const after = await this.getCategory(tenantId, category);

    await this.audit.record({
      actor,
      tenantId,
      action: `settings.${category}.updated`,
      entityType: 'tenant_settings',
      entityId: category,
      beforeState: before,
      afterState: after,
      meta,
    });

    return after;
  }

  // ---------------------------------------------------------------------------
  // Public (no-auth) settings for the tenant's website. Never expose internal
  // configuration or feature flags — only the public-facing presentation layer.
  // ---------------------------------------------------------------------------

  async getPublicSettings(slug: string) {
    const org = await this.repo.findOrganizationBySlug(slug);
    if (!org || org.status === 'suspended') {
      throw new NotFoundException('Site not available');
    }
    const [branding, website, seo, whiteLabel] = await Promise.all([
      this.getCategory(org.id, 'branding'),
      this.getCategory(org.id, 'website'),
      this.getCategory(org.id, 'seo'),
      this.getCategory(org.id, 'white_label'),
    ]);

    const wl = whiteLabel as Json;
    const hideBranding = wl.enabled === true && wl.hide_branding === true;

    return {
      tenant: org.slug,
      name: org.name,
      branding,
      website,
      seo,
      white_label: {
        enabled: wl.enabled ?? false,
        hide_branding: hideBranding,
        custom_logo_url: wl.custom_logo_url ?? null,
        custom_favicon_url: wl.custom_favicon_url ?? null,
        primary_color: wl.primary_color ?? null,
        secondary_color: wl.secondary_color ?? null,
        custom_login: wl.custom_login ?? null,
      },
      powered_by_reos: !hideBranding,
    };
  }
}
