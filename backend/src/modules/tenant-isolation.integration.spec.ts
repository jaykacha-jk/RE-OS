import { NotFoundException } from '@nestjs/common';

import { AuditService } from './audit/audit.service';
import { CrmRepository } from './crm/crm.repository';
import { CrmService } from './crm/crm.service';
import { PropertiesRepository } from './properties/properties.repository';
import { PropertiesService } from './properties/properties.service';

const now = new Date('2026-01-01T00:00:00.000Z');

const tenants = [
  { id: 'tenant-a', name: 'Tenant A', slug: 'alpha', status: 'active', deleted_at: null },
  { id: 'tenant-b', name: 'Tenant B', slug: 'beta', status: 'active', deleted_at: null },
];

function makePublicProperty(tenantId: string, id: string, title: string) {
  return {
    id,
    tenant_id: tenantId,
    title,
    slug: 'shared-slug',
    description: 'Public listing',
    type: 'residential',
    category: 'flat',
    requirement_type: 'buy',
    price: 5000000,
    maintenance: null,
    city: 'Ahmedabad',
    state: 'Gujarat',
    country: 'India',
    pincode: '380015',
    bedrooms: 3,
    bathrooms: 2,
    balconies: 1,
    super_builtup_area: 1500,
    carpet_area: 1200,
    meta_title: null,
    meta_description: null,
    deleted_at: null,
    is_public: true,
    status: 'published',
    published_at: now,
    images: [{ url: `https://cdn.example/${id}.jpg`, alt_text: title, is_cover: true, sort_order: 0 }],
    videos: [],
    amenities: [{ name: 'Lift' }],
    tags: [{ tag: 'verified' }],
  };
}

function matchesWhere(row: Record<string, any>, where: Record<string, any>) {
  return Object.entries(where).every(([key, expected]) => {
    if (key === 'images') return row.images.length > 0;
    if (key === 'city' && expected?.equals) {
      return String(row.city).toLowerCase() === String(expected.equals).toLowerCase();
    }
    return row[key] === expected;
  });
}

function buildPropertiesService() {
  const rows = [
    makePublicProperty('tenant-a', 'prop-a', 'Alpha listing'),
    makePublicProperty('tenant-b', 'prop-b', 'Beta listing'),
  ];
  const dbClient = {
    organizations: {
      findFirst: jest.fn(({ where }) => tenants.find((tenant) => matchesWhere(tenant, where)) ?? null),
    },
    properties: {
      findMany: jest.fn(({ where }) => rows.filter((row) => matchesWhere(row, where))),
      count: jest.fn(({ where }) => rows.filter((row) => matchesWhere(row, where)).length),
      findFirst: jest.fn(({ where }) => rows.find((row) => matchesWhere(row, where)) ?? null),
    },
  };
  const repo = new PropertiesRepository({ dbClient } as never);
  const service = new PropertiesService(
    repo,
    { saveBase64: jest.fn(), delete: jest.fn() } as never,
    { record: jest.fn() } as unknown as AuditService,
    { emit: jest.fn(), on: jest.fn() } as never,
  );
  return { service, dbClient };
}

function buildCrmService() {
  const rows = [makePublicProperty('tenant-b', 'prop-b', 'Beta listing')];
  const dbClient = {
    organizations: {
      findFirst: jest.fn(({ where }) => tenants.find((tenant) => matchesWhere(tenant, where)) ?? null),
    },
    properties: {
      findFirst: jest.fn(({ where }) => rows.find((row) => matchesWhere(row, where)) ?? null),
    },
  };
  const repo = new CrmRepository({ dbClient } as never);
  const service = new CrmService(
    repo,
    { record: jest.fn() } as unknown as AuditService,
    { emit: jest.fn(), on: jest.fn() } as never,
  );
  return { service, dbClient };
}

describe('tenant isolation integration', () => {
  it('returns only the requested tenant public listings when another tenant has matching inventory', async () => {
    const { service, dbClient } = buildPropertiesService();

    const result = await service.listPublic({
      tenant: 'alpha',
      city: 'Ahmedabad',
      page: 1,
      perPage: 10,
    });

    expect(result.meta.tenant).toBe('alpha');
    expect(result.meta.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].title).toBe('Alpha listing');
    expect(dbClient.properties.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: 'tenant-a' }),
      }),
    );
  });

  it('does not resolve a public property slug from another tenant', async () => {
    const { service, dbClient } = buildPropertiesService();

    await expect(service.getPublicBySlug('shared-slug', 'alpha')).resolves.toMatchObject({
      title: 'Alpha listing',
    });
    await expect(service.getPublicBySlug('missing-in-alpha', 'alpha')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(dbClient.properties.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: 'tenant-a', slug: 'missing-in-alpha' }),
      }),
    );
  });

  it('rejects a public inquiry when property_slug belongs to a different tenant', async () => {
    const { service, dbClient } = buildCrmService();

    await expect(
      service.createPublicInquiry('alpha', {
        client_name: 'Rahul Shah',
        phone: '+919876543210',
        property_slug: 'shared-slug',
        message: 'Please call me',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(dbClient.properties.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: 'tenant-a', slug: 'shared-slug' }),
      }),
    );
  });
});
