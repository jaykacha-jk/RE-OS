import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PlatformService } from './platform.service';

describe('PlatformService — organization logo', () => {
  const buildService = () => {
    const platformRepository = {
      findOrganizationById: jest.fn(),
      updateOrganization: jest.fn(),
    };
    const storage = {
      decodedByteLength: jest.fn().mockReturnValue(1024),
      saveOrgLogo: jest.fn().mockResolvedValue({
        storageKey: 'platform/organizations/org-1/logo/abc.png',
        url: 'http://localhost:3001/static/platform/organizations/org-1/logo/abc.png',
      }),
      resolveUrl: jest.fn((value: string | null) =>
        value ? `http://localhost:3001/static/${value}` : null,
      ),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PlatformService(
      platformRepository as never,
      { record: jest.fn() } as never,
      { emit: jest.fn() } as never,
      storage as never,
      { syncOrganizationPlanFromPlatform: jest.fn() } as never,
    );
    return { service, platformRepository, storage };
  };

  const org = {
    id: 'org-1',
    name: 'Acme',
    slug: 'acme',
    status: 'active',
    tier: 'pro',
    billing_email: 'bill@acme.in',
    logo_url: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    organization_usage: { properties_count: 1, employees_count: 2 },
  };

  it('rejects logo uploads without content_type', async () => {
    const { service, platformRepository } = buildService();
    platformRepository.findOrganizationById.mockResolvedValue(org);

    await expect(
      service.uploadOrganizationLogo('org-1', { content_base64: 'abc' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects oversized logo uploads', async () => {
    const { service, platformRepository, storage } = buildService();
    platformRepository.findOrganizationById.mockResolvedValue(org);
    storage.decodedByteLength.mockReturnValue(11 * 1024 * 1024);

    await expect(
      service.uploadOrganizationLogo('org-1', {
        content_base64: 'abc',
        content_type: 'image/png',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('stores a valid logo and updates the organization', async () => {
    const { service, platformRepository, storage } = buildService();
    platformRepository.findOrganizationById.mockResolvedValue(org);
    platformRepository.updateOrganization.mockResolvedValue({
      ...org,
      logo_url: 'platform/organizations/org-1/logo/abc.png',
    });

    const result = await service.uploadOrganizationLogo('org-1', {
      content_base64: Buffer.from('png').toString('base64'),
      content_type: 'image/png',
      filename: 'logo.png',
    });

    expect(storage.saveOrgLogo).toHaveBeenCalled();
    expect(platformRepository.updateOrganization).toHaveBeenCalledWith('org-1', {
      logo_url: 'platform/organizations/org-1/logo/abc.png',
    });
    expect(result.logo_url).toContain('platform/organizations/org-1/logo/abc.png');
  });

  it('returns 404 when organization is missing', async () => {
    const { service, platformRepository } = buildService();
    platformRepository.findOrganizationById.mockResolvedValue(null);

    await expect(
      service.uploadOrganizationLogo('missing', {
        content_base64: Buffer.from('x').toString('base64'),
        content_type: 'image/png',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PlatformService — impersonation', () => {
  const org = {
    id: 'org-1',
    name: 'Acme Realty',
    slug: 'acme',
    status: 'active',
    tier: 'pro',
    billing_email: 'bill@acme.in',
    logo_url: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    organization_usage: { properties_count: 1, employees_count: 2 },
  };

  it('records audit when impersonation starts', async () => {
    const platformRepository = { findOrganizationById: jest.fn().mockResolvedValue(org) };
    const auditService = { record: jest.fn() };
    const service = new PlatformService(
      platformRepository as never,
      auditService as never,
      { emit: jest.fn() } as never,
      { resolveUrl: jest.fn() } as never,
      { syncOrganizationPlanFromPlatform: jest.fn() } as never,
    );

    const result = await service.startImpersonation('org-1', {
      userId: 'admin-1',
      tenantId: null,
      roles: ['super_admin'],
      permissions: ['platform.impersonate'],
    });

    expect(result).toEqual({ tenant_id: 'org-1', name: 'Acme Realty', slug: 'acme' });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'platform.impersonation.started',
        entityId: 'org-1',
        tenantId: 'org-1',
      }),
    );
  });

  it('records audit when impersonation ends', async () => {
    const auditService = { record: jest.fn() };
    const service = new PlatformService(
      {} as never,
      auditService as never,
      { emit: jest.fn() } as never,
      { resolveUrl: jest.fn() } as never,
      { syncOrganizationPlanFromPlatform: jest.fn() } as never,
    );

    await service.endImpersonation('org-1', {
      userId: 'admin-1',
      tenantId: null,
      roles: ['super_admin'],
      permissions: ['platform.impersonate'],
    });

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'platform.impersonation.ended',
        entityId: 'org-1',
      }),
    );
  });
});
