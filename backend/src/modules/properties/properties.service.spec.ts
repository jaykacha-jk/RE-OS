import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import type { AuthUser } from '../../common/context/auth-user';
import { PropertiesService } from './properties.service';
import type { PropertiesRepository, PropertyScope } from './properties.repository';
import type { StorageService } from './storage/storage.service';
import type { AuditService } from '../audit/audit.service';

const TENANT = 'tenant-1';

function makeUser(roles: string[], userId = 'user-1'): AuthUser {
  return {
    userId,
    tenantId: TENANT,
    roles,
    permissions: [],
    email: `${userId}@example.com`,
  } as unknown as AuthUser;
}

type FakeProperty = ReturnType<typeof makeProperty>;

function makeProperty(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'prop-1',
    property_code: 'PROP-ABC123',
    title: '3BHK Flat',
    slug: '3bhk-flat',
    description: 'Nice flat',
    type: 'residential',
    category: 'flat',
    requirement_type: 'sell',
    price: 5000000,
    maintenance: 2000,
    token_amount: 100000,
    address: '12 MG Road',
    city: 'Ahmedabad',
    state: 'Gujarat',
    country: 'India',
    pincode: '380001',
    latitude: 23.02,
    longitude: 72.57,
    bedrooms: 3,
    bathrooms: 2,
    balconies: 1,
    floor: 4,
    total_floors: 10,
    super_builtup_area: 1500,
    carpet_area: 1200,
    status: 'draft',
    is_public: false,
    meta_title: null,
    meta_description: null,
    amenities: [{ name: 'lift' }],
    tags: [{ tag: 'premium' }],
    images: [],
    videos: [],
    documents: [],
    assignments: [],
    created_by: 'user-1',
    updated_by: 'user-1',
    published_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function buildService() {
  const repo: jest.Mocked<Partial<PropertiesRepository>> = {
    findOrganizationWithUsage: jest.fn(),
    findPlanMaxProperties: jest.fn(),
    findEmployeeByUserId: jest.fn(),
    findSubordinateEmployeeIds: jest.fn(),
    findEmployeesByIds: jest.fn(),
    slugExists: jest.fn().mockResolvedValue(false),
    propertyCodeExists: jest.fn().mockResolvedValue(false),
    createProperty: jest.fn(),
    findById: jest.fn(),
    buildWhere: jest.fn().mockReturnValue({ tenant_id: TENANT }),
    list: jest.fn(),
    summary: jest.fn(),
    updateProperty: jest.fn(),
    softDelete: jest.fn(),
    replaceAssignments: jest.fn(),
    listHistory: jest.fn(),
  };
  const storage = {
    saveBase64: jest.fn(),
    delete: jest.fn(),
    resolveUrl: jest.fn((value: string | null | undefined) => value ?? null),
  } as unknown as jest.Mocked<StorageService>;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<AuditService>;

  const events = { emit: jest.fn(), on: jest.fn() } as any;

  const service = new PropertiesService(
    repo as unknown as PropertiesRepository,
    storage,
    audit,
    events,
  );
  return { service, repo, storage, audit, events };
}

describe('PropertiesService — RBAC scope', () => {
  it('grants full scope to org_admin / org_owner / super_admin', async () => {
    const { service, repo } = buildService();
    for (const role of ['super_admin', 'org_owner', 'org_admin']) {
      const scope: PropertyScope = await service.resolveScope(makeUser([role]), TENANT);
      expect(scope).toEqual({ type: 'all' });
    }
    expect(repo.findEmployeeByUserId).not.toHaveBeenCalled();
  });

  it('scopes a sales_manager to self + direct reports', async () => {
    const { service, repo } = buildService();
    repo.findEmployeeByUserId!.mockResolvedValue({ id: 'emp-mgr' } as never);
    repo.findSubordinateEmployeeIds!.mockResolvedValue(['emp-a', 'emp-b']);

    const scope = await service.resolveScope(makeUser(['sales_manager']), TENANT);

    expect(scope).toEqual({ type: 'employees', employeeIds: ['emp-mgr', 'emp-a', 'emp-b'] });
  });

  it('scopes a sales_executive to only their own assignments', async () => {
    const { service, repo } = buildService();
    repo.findEmployeeByUserId!.mockResolvedValue({ id: 'emp-exec' } as never);

    const scope = await service.resolveScope(makeUser(['sales_executive']), TENANT);

    expect(scope).toEqual({ type: 'employees', employeeIds: ['emp-exec'] });
    expect(repo.findSubordinateEmployeeIds).not.toHaveBeenCalled();
  });

  it('scopes a telecaller to assigned properties only', async () => {
    const { service, repo } = buildService();
    repo.findEmployeeByUserId!.mockResolvedValue({ id: 'emp-call' } as never);

    const scope = await service.resolveScope(makeUser(['telecaller']), TENANT);

    expect(scope).toEqual({ type: 'employees', employeeIds: ['emp-call'] });
    expect(repo.findSubordinateEmployeeIds).not.toHaveBeenCalled();
  });

  it('returns an empty employee scope when the user has no employee record', async () => {
    const { service, repo } = buildService();
    repo.findEmployeeByUserId!.mockResolvedValue(null as never);

    const scope = await service.resolveScope(makeUser(['sales_executive']), TENANT);

    expect(scope).toEqual({ type: 'employees', employeeIds: [] });
  });
});

describe('PropertiesService — summary KPIs', () => {
  it('aggregates property KPIs from full-scope repository summary using list filters', async () => {
    const { service, repo } = buildService();
    repo.buildWhere!.mockReturnValue({
      tenant_id: TENANT,
      deleted_at: null,
      city: { equals: 'Ahmedabad', mode: 'insensitive' },
    } as never);
    repo.summary!.mockResolvedValue({
      statusRows: [
        { status: 'published', _count: { _all: 12 } },
        { status: 'reserved', _count: { _all: 3 } },
        { status: 'sold', _count: { _all: 2 } },
        { status: 'draft', _count: { _all: 4 } },
      ],
      publicCount: 10,
      totalValue: 125000000,
    } as never);

    const res = await service.summary(
      TENANT,
      makeUser(['org_owner']),
      {
        search: 'sg highway',
        'filter[city]': 'Ahmedabad',
      } as any,
    );

    expect(repo.buildWhere).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({
        search: 'sg highway',
        city: 'Ahmedabad',
      }),
      { type: 'all' },
    );
    expect(res).toEqual({
      total: 21,
      published: 12,
      reserved: 3,
      sold: 2,
      draft: 4,
      public_listings: 10,
      total_value: 125000000,
      by_status: {
        draft: 4,
        pending_review: 0,
        published: 12,
        reserved: 3,
        sold: 2,
        archived: 0,
      },
    });
    expect(repo.list).not.toHaveBeenCalled();
  });
});

describe('PropertiesService — access enforcement', () => {
  it('hides out-of-scope properties as 404 for a sales_executive', async () => {
    const { service, repo } = buildService();
    repo.findById!.mockResolvedValue(
      makeProperty({ assignments: [{ employee_id: 'emp-other', is_primary: true, assigned_at: new Date(), assigned_by: 'u' }] }) as never,
    );
    repo.findEmployeeByUserId!.mockResolvedValue({ id: 'emp-me' } as never);

    await expect(service.getOne(TENANT, makeUser(['sales_executive']), 'prop-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('allows access when the property is assigned to the executive', async () => {
    const { service, repo } = buildService();
    repo.findById!.mockResolvedValue(
      makeProperty({ assignments: [{ employee_id: 'emp-me', is_primary: true, assigned_at: new Date(), assigned_by: 'u' }] }) as never,
    );
    repo.findEmployeeByUserId!.mockResolvedValue({ id: 'emp-me' } as never);

    const result = await service.getOne(TENANT, makeUser(['sales_executive']), 'prop-1');
    expect(result.id).toBe('prop-1');
  });

  it('throws 404 for a missing property', async () => {
    const { service, repo } = buildService();
    repo.findById!.mockResolvedValue(null as never);
    await expect(service.getOne(TENANT, makeUser(['org_admin']), 'nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('PropertiesService — create + quota + slug', () => {
  const baseDto = {
    title: '3BHK Flat in SG Highway',
    type: 'residential',
    category: 'flat',
    requirement_type: 'sell',
    city: 'Ahmedabad',
    price: 5000000,
  } as never;

  function primeCreate(repo: jest.Mocked<Partial<PropertiesRepository>>) {
    repo.findOrganizationWithUsage!.mockResolvedValue({
      id: TENANT,
      tier: 'starter',
      organization_usage: { properties_count: 1 },
    } as never);
    repo.findPlanMaxProperties!.mockResolvedValue({ max_properties: 50 } as never);
    repo.createProperty!.mockResolvedValue('prop-1');
    repo.findById!.mockResolvedValue(makeProperty() as never);
  }

  it('enforces the plan property quota (BR-T04)', async () => {
    const { service, repo } = buildService();
    repo.findOrganizationWithUsage!.mockResolvedValue({
      id: TENANT,
      tier: 'starter',
      organization_usage: { properties_count: 50 },
    } as never);
    repo.findPlanMaxProperties!.mockResolvedValue({ max_properties: 50 } as never);

    await expect(service.create(TENANT, baseDto, makeUser(['org_admin']))).rejects.toMatchObject({
      response: { code: 'QUOTA_EXCEEDED', rule_id: 'BR-T04' },
    });
    expect(repo.createProperty).not.toHaveBeenCalled();
  });

  it('creates a property and generates a unique slug + property code', async () => {
    const { service, repo, audit } = buildService();
    primeCreate(repo);

    const result = await service.create(TENANT, baseDto, makeUser(['org_admin']));

    expect(repo.createProperty).toHaveBeenCalledTimes(1);
    const arg = repo.createProperty!.mock.calls[0][0] as { data: { slug: string; property_code: string } };
    expect(arg.data.slug).toBe('3bhk-flat-in-sg-highway');
    expect(arg.data.property_code).toMatch(/^PROP-/);
    expect(result.id).toBe('prop-1');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'properties.created' }));
  });

  it('appends a numeric suffix when the slug already exists', async () => {
    const { service, repo } = buildService();
    primeCreate(repo);
    repo.slugExists!.mockResolvedValueOnce(true).mockResolvedValue(false);

    await service.create(TENANT, baseDto, makeUser(['org_admin']));

    const arg = repo.createProperty!.mock.calls[0][0] as { data: { slug: string } };
    expect(arg.data.slug).toBe('3bhk-flat-in-sg-highway-2');
  });
});

describe('PropertiesService — status workflow + history', () => {
  it('rejects an invalid status transition (sold -> published)', async () => {
    const { service, repo } = buildService();
    repo.findById!.mockResolvedValue(makeProperty({ status: 'sold' }) as never);

    await expect(
      service.update(TENANT, makeUser(['org_admin']), 'prop-1', { status: 'published' } as never),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(repo.updateProperty).not.toHaveBeenCalled();
  });

  it('records price + status history entries on a valid update', async () => {
    const { service, repo } = buildService();
    repo.findById!
      .mockResolvedValueOnce(makeProperty({ status: 'draft', price: 5000000 }) as never)
      .mockResolvedValueOnce(makeProperty({ status: 'published', price: 6000000 }) as never);

    await service.update(
      TENANT,
      makeUser(['org_admin']),
      'prop-1',
      { status: 'published', price: 6000000 } as never,
    );

    const arg = repo.updateProperty!.mock.calls[0][0] as {
      historyEntries: { change_type: string }[];
      data: { published_at?: Date };
    };
    const types = arg.historyEntries.map((h) => h.change_type);
    expect(types).toEqual(expect.arrayContaining(['price_changed', 'status_changed']));
    expect(arg.data.published_at).toBeInstanceOf(Date);
  });

  it('forces is_public=false when a property is archived (BR-P07)', async () => {
    const { service, repo } = buildService();
    repo.findById!
      .mockResolvedValueOnce(makeProperty({ status: 'published', is_public: true }) as never)
      .mockResolvedValueOnce(makeProperty({ status: 'archived', is_public: false }) as never);

    await service.update(TENANT, makeUser(['org_admin']), 'prop-1', { status: 'archived' } as never);

    const arg = repo.updateProperty!.mock.calls[0][0] as { data: { is_public?: boolean } };
    expect(arg.data.is_public).toBe(false);
  });
});

describe('PropertiesService — assignment logic', () => {
  it('rejects employee_ids that do not belong to the tenant', async () => {
    const { service, repo } = buildService();
    repo.findById!.mockResolvedValue(makeProperty() as never);
    repo.findEmployeesByIds!.mockResolvedValue([{ id: 'emp-a' }] as never); // only 1 of 2 found

    await expect(
      service.assign(TENANT, makeUser(['org_admin']), 'prop-1', {
        employee_ids: ['emp-a', 'emp-ghost'],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a primary_employee_id outside employee_ids', async () => {
    const { service, repo } = buildService();
    repo.findById!.mockResolvedValue(makeProperty() as never);
    repo.findEmployeesByIds!.mockResolvedValue([{ id: 'emp-a' }] as never);

    await expect(
      service.assign(TENANT, makeUser(['org_admin']), 'prop-1', {
        employee_ids: ['emp-a'],
        primary_employee_id: 'emp-b',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('replaces assignments and defaults the primary to the first employee', async () => {
    const { service, repo, audit } = buildService();
    repo.findById!.mockResolvedValue(makeProperty() as never);
    repo.findEmployeesByIds!.mockResolvedValue([{ id: 'emp-a' }, { id: 'emp-b' }] as never);

    await service.assign(TENANT, makeUser(['org_admin']), 'prop-1', {
      employee_ids: ['emp-a', 'emp-b'],
    } as never);

    const arg = repo.replaceAssignments!.mock.calls[0][0] as { primaryEmployeeId: string; employeeIds: string[] };
    expect(arg.primaryEmployeeId).toBe('emp-a');
    expect(arg.employeeIds).toEqual(['emp-a', 'emp-b']);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'properties.assigned' }));
  });

  it('deduplicates repeated employee_ids', async () => {
    const { service, repo } = buildService();
    repo.findById!.mockResolvedValue(makeProperty() as never);
    repo.findEmployeesByIds!.mockResolvedValue([{ id: 'emp-a' }] as never);

    await service.assign(TENANT, makeUser(['org_admin']), 'prop-1', {
      employee_ids: ['emp-a', 'emp-a'],
    } as never);

    const arg = repo.replaceAssignments!.mock.calls[0][0] as { employeeIds: string[] };
    expect(arg.employeeIds).toEqual(['emp-a']);
  });
});

describe('PropertiesService — list/search', () => {
  it('passes the resolved scope + filters to the repository and maps results', async () => {
    const { service, repo } = buildService();
    repo.list!.mockResolvedValue({ rows: [makeProperty()], total: 1 } as never);

    const result = await service.list(TENANT, makeUser(['org_admin']), {
      search: 'flat',
      'filter[city]': 'Ahmedabad',
      'filter[min_price]': 1000000,
      page: 1,
      per_page: 20,
    } as never);

    expect(repo.buildWhere).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({ search: 'flat', city: 'Ahmedabad', minPrice: 1000000 }),
      { type: 'all' },
    );
    expect(result.meta).toEqual({ page: 1, per_page: 20, total: 1, total_pages: 1 });
    expect(result.data[0].property_code).toBe('PROP-ABC123');
  });
});

describe('PropertiesService — soft delete', () => {
  it('soft deletes an accessible property and writes an audit record', async () => {
    const { service, repo, audit } = buildService();
    repo.findById!.mockResolvedValue(makeProperty() as never);
    repo.softDelete!.mockResolvedValue(true as never);

    const res = await service.remove(TENANT, makeUser(['org_admin']), 'prop-1');

    expect(res).toEqual({ id: 'prop-1', deleted: true });
    expect(repo.softDelete).toHaveBeenCalledWith(TENANT, 'prop-1');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'properties.deleted' }));
  });
});
