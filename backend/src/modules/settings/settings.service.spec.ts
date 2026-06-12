import type { AuthUser } from '../../common/context/auth-user';
import { AuditService } from '../audit/audit.service';
import { SettingsCacheService } from './settings-cache.service';
import { SettingsRepository } from './settings.repository';
import { SettingsService, deepMerge } from './settings.service';
import { DEFAULT_BRANDING } from './settings.constants';

const TENANT = 'tenant-1';

function makeUser(): AuthUser {
  return { userId: 'user-1', tenantId: TENANT, roles: ['org_owner'], permissions: [] };
}

function build() {
  const repo: jest.Mocked<Partial<SettingsRepository>> = {
    findCategory: jest.fn().mockResolvedValue(null),
    upsertCategory: jest.fn().mockResolvedValue(undefined),
    findOrganizationBySlug: jest.fn(),
  };
  // Pass-through cache so each call exercises the real resolution logic.
  const cache = {
    wrap: jest.fn((_key: string, fn: () => Promise<unknown>) => fn()),
    invalidate: jest.fn(),
  } as unknown as SettingsCacheService;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;

  const service = new SettingsService(repo as unknown as SettingsRepository, cache, audit);
  return { service, repo, cache, audit };
}

describe('deepMerge', () => {
  it('merges nested objects and replaces arrays/scalars', () => {
    const base = { a: 1, nested: { x: 1, y: 2 }, list: [1, 2] };
    const patch = { a: 2, nested: { y: 3, z: 4 }, list: [9] };
    expect(deepMerge(base, patch)).toEqual({
      a: 2,
      nested: { x: 1, y: 3, z: 4 },
      list: [9],
    });
  });

  it('ignores undefined values but honours explicit null (clear)', () => {
    const base = { keep: 'a', clear: 'b' } as Record<string, unknown>;
    const patch = { keep: undefined, clear: null } as Record<string, unknown>;
    expect(deepMerge(base, patch)).toEqual({ keep: 'a', clear: null });
  });
});

describe('SettingsService', () => {
  describe('getCategory', () => {
    it('returns full defaults when nothing is stored', async () => {
      const { service } = build();
      const branding = await service.getCategory(TENANT, 'branding');
      expect(branding).toEqual(DEFAULT_BRANDING);
    });

    it('merges stored values over defaults', async () => {
      const { service, repo } = build();
      repo.findCategory!.mockResolvedValue({ data: { primary_color: '#123456' } } as never);
      const branding = (await service.getCategory(TENANT, 'branding')) as Record<string, unknown>;
      expect(branding.primary_color).toBe('#123456');
      // Untouched defaults still present.
      expect(branding.font_family).toBe(DEFAULT_BRANDING.font_family);
    });
  });

  describe('updateCategory', () => {
    it('deep-merges patch over stored data, invalidates cache and audits', async () => {
      const { service, repo, cache, audit } = build();
      repo.findCategory!.mockResolvedValue({ data: { primary_color: '#000000' } } as never);

      await service.updateCategory(
        TENANT,
        'branding',
        { secondary_color: '#ffffff' },
        makeUser(),
      );

      expect(repo.upsertCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT,
          category: 'branding',
          data: expect.objectContaining({ primary_color: '#000000', secondary_color: '#ffffff' }),
        }),
      );
      expect(cache.invalidate).toHaveBeenCalledWith(`settings:${TENANT}:`);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'settings.branding.updated' }),
      );
    });
  });

  describe('getPublicSettings', () => {
    it('hides RE-OS branding only when white-label is enabled + hide_branding', async () => {
      const { service, repo } = build();
      repo.findOrganizationBySlug!.mockResolvedValue({
        id: TENANT,
        name: 'ABC Realty',
        slug: 'abc',
        status: 'active',
      } as never);
      repo.findCategory!.mockImplementation((_t: string, category: string) => {
        if (category === 'white_label') {
          return Promise.resolve({ data: { enabled: true, hide_branding: true } } as never);
        }
        return Promise.resolve(null as never);
      });

      const res = (await service.getPublicSettings('abc')) as Record<string, any>;
      expect(res.white_label.hide_branding).toBe(true);
      expect(res.powered_by_reos).toBe(false);
    });

    it('keeps RE-OS branding when white-label disabled', async () => {
      const { service, repo } = build();
      repo.findOrganizationBySlug!.mockResolvedValue({
        id: TENANT,
        name: 'ABC',
        slug: 'abc',
        status: 'active',
      } as never);
      const res = (await service.getPublicSettings('abc')) as Record<string, any>;
      expect(res.powered_by_reos).toBe(true);
    });

    it('404s a suspended or unknown tenant', async () => {
      const { service, repo } = build();
      repo.findOrganizationBySlug!.mockResolvedValue(null as never);
      await expect(service.getPublicSettings('nope')).rejects.toThrow('Site not available');
    });
  });
});
