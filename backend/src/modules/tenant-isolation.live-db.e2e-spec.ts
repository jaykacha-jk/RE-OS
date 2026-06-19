import 'dotenv/config';
import { NotFoundException } from '@nestjs/common';

import { PrismaService } from '../common/database/prisma.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { AuditService } from './audit/audit.service';
import { CrmRepository } from './crm/crm.repository';
import { CrmService } from './crm/crm.service';
import { PropertiesRepository } from './properties/properties.repository';
import { PropertiesService } from './properties/properties.service';

const tenantIds = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
];

const alpha = {
  id: tenantIds[0],
  slug: 'tenant-e2e-alpha',
  name: 'Tenant E2E Alpha',
};

const beta = {
  id: tenantIds[1],
  slug: 'tenant-e2e-beta',
  name: 'Tenant E2E Beta',
};

const alphaSharedPropertyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const betaSharedPropertyId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const betaOnlyPropertyId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';

describe('tenant isolation live-db e2e', () => {
  let prisma: PrismaService;
  let properties: PropertiesService;
  let crm: CrmService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set for live tenant-isolation e2e tests');
    }

    prisma = new PrismaService();
    const eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as DomainEventBus;
    const audit = { record: jest.fn() } as unknown as AuditService;

    properties = new PropertiesService(
      new PropertiesRepository(prisma),
      { saveBase64: jest.fn(), delete: jest.fn() } as never,
      audit,
      eventBus,
      {
        assertCanCreateProperty: jest.fn().mockResolvedValue({}),
        assertStorageAvailable: jest.fn().mockResolvedValue({}),
        recordStorageBytes: jest.fn().mockResolvedValue(undefined),
      } as never,
    );
    crm = new CrmService(new CrmRepository(prisma), audit, eventBus);

    await cleanTenantRows();
    await seedTenantRows();
  });

  afterAll(async () => {
    if (!prisma) return;
    await cleanTenantRows();
    await prisma.onModuleDestroy();
  });

  async function cleanTenantRows() {
    const db = prisma.dbClient;

    await db.inquiry_activities.deleteMany({ where: { tenant_id: { in: tenantIds } } });
    await db.inquiry_history.deleteMany({ where: { tenant_id: { in: tenantIds } } });
    await db.inquiries.deleteMany({ where: { tenant_id: { in: tenantIds } } });

    await db.property_images.deleteMany({ where: { tenant_id: { in: tenantIds } } });
    await db.property_amenities.deleteMany({ where: { tenant_id: { in: tenantIds } } });
    await db.property_tags.deleteMany({ where: { tenant_id: { in: tenantIds } } });
    await db.properties.deleteMany({ where: { tenant_id: { in: tenantIds } } });

    await db.organization_usage.deleteMany({ where: { tenant_id: { in: tenantIds } } });
    await db.organizations.deleteMany({ where: { id: { in: tenantIds } } });
  }

  async function seedTenantRows() {
    const db = prisma.dbClient;
    const publishedAt = new Date('2026-01-01T00:00:00.000Z');

    await db.organizations.createMany({
      data: [
        {
          id: alpha.id,
          slug: alpha.slug,
          name: alpha.name,
          billing_email: 'alpha@example.test',
          status: 'active',
          tier: 'pro',
        },
        {
          id: beta.id,
          slug: beta.slug,
          name: beta.name,
          billing_email: 'beta@example.test',
          status: 'active',
          tier: 'pro',
        },
      ],
    });

    await db.organization_usage.createMany({
      data: tenantIds.map((tenant_id) => ({
        tenant_id,
        properties_count: 0,
        employees_count: 0,
        ai_minutes_used: 0,
        storage_bytes: 0n,
      })),
    });

    await db.properties.createMany({
      data: [
        propertyRow(alpha.id, alphaSharedPropertyId, 'ALPHA-E2E-1', 'Alpha shared listing', 'shared-live-slug', publishedAt),
        propertyRow(beta.id, betaSharedPropertyId, 'BETA-E2E-1', 'Beta shared listing', 'shared-live-slug', publishedAt),
        propertyRow(beta.id, betaOnlyPropertyId, 'BETA-E2E-2', 'Beta only listing', 'beta-only-live-slug', publishedAt),
      ],
    });

    await db.property_images.createMany({
      data: [
        imageRow(alpha.id, alphaSharedPropertyId, 'alpha-shared'),
        imageRow(beta.id, betaSharedPropertyId, 'beta-shared'),
        imageRow(beta.id, betaOnlyPropertyId, 'beta-only'),
      ],
    });
  }

  function propertyRow(
    tenantId: string,
    id: string,
    propertyCode: string,
    title: string,
    slug: string,
    publishedAt: Date,
  ) {
    return {
      id,
      tenant_id: tenantId,
      property_code: propertyCode,
      title,
      slug,
      description: 'Live tenant isolation e2e listing',
      type: 'residential',
      category: 'flat',
      requirement_type: 'buy',
      price: 5000000,
      address: 'E2E Street',
      city: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India',
      pincode: '380015',
      bedrooms: 3,
      bathrooms: 2,
      balconies: 1,
      super_builtup_area: 1500,
      carpet_area: 1200,
      status: 'published',
      is_public: true,
      published_at: publishedAt,
    };
  }

  function imageRow(tenantId: string, propertyId: string, key: string) {
    return {
      tenant_id: tenantId,
      property_id: propertyId,
      url: `https://cdn.example.test/${key}.jpg`,
      alt_text: key,
      sort_order: 0,
      is_cover: true,
    };
  }

  it('lists only public properties for the requested tenant even when another tenant has matching inventory', async () => {
    const result = await properties.listPublic({
      tenant: alpha.slug,
      city: 'Ahmedabad',
      page: 1,
      perPage: 10,
    });

    expect(result.meta.tenant).toBe(alpha.slug);
    expect(result.meta.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      title: 'Alpha shared listing',
      slug: 'shared-live-slug',
    });
  });

  it('resolves an overlapping public slug inside the requested tenant only', async () => {
    await expect(properties.getPublicBySlug('shared-live-slug', alpha.slug)).resolves.toMatchObject({
      title: 'Alpha shared listing',
    });

    await expect(properties.getPublicBySlug('shared-live-slug', beta.slug)).resolves.toMatchObject({
      title: 'Beta shared listing',
    });
  });

  it('rejects public inquiry creation when property_slug exists only in another tenant', async () => {
    await expect(
      crm.createPublicInquiry(alpha.slug, {
        client_name: 'Rahul Shah',
        phone: '+919876543210',
        property_slug: 'beta-only-live-slug',
        message: 'Please call me',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const leakedInquiry = await prisma.dbClient.inquiries.findFirst({
      where: {
        tenant_id: alpha.id,
        phone: '+919876543210',
      },
    });
    expect(leakedInquiry).toBeNull();
  });
});
