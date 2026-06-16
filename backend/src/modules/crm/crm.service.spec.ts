import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import type { AuthUser } from '../../common/context/auth-user';
import { CrmService } from './crm.service';
import type { CrmRepository, InquiryScope } from './crm.repository';
import type { AuditService } from '../audit/audit.service';

const TENANT = 'tenant-1';

function makeUser(roles: string[], userId = 'user-1'): AuthUser {
  return { userId, tenantId: TENANT, roles, permissions: [] } as unknown as AuthUser;
}

function makeInquiry(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'inq-1',
    tenant_id: TENANT,
    inquiry_code: 'INQ-ABC123',
    property_id: null,
    assigned_employee_id: null,
    source_id: null,
    source_name: null,
    client_name: 'Rahul Sharma',
    phone: '+919876543210',
    email: 'rahul@example.com',
    whatsapp: null,
    budget_min: 5000000,
    budget_max: 8000000,
    booking_amount: null,
    expected_commission: null,
    received_commission: null,
    commission_status: null,
    requirement_type: 'buy',
    preferred_location: 'SG Highway',
    property_type: 'residential',
    bedrooms: 3,
    purchase_timeline: 'immediate',
    stage: 'NEW',
    priority: 'medium',
    temperature: 'warm',
    lead_score: 60,
    no_property_reason: null,
    lost_reason: null,
    closed_at: null,
    remarks: null,
    created_by: 'user-1',
    updated_by: 'user-1',
    created_at: now,
    updated_at: now,
    assigned_employee: null,
    source: null,
    property: null,
    notes: [],
    followups: [],
    site_visits: [],
    ...overrides,
  };
}

function buildService() {
  const repo: jest.Mocked<Partial<CrmRepository>> = {
    findEmployeeByUserId: jest.fn(),
    findEmployeeById: jest.fn(),
    findSubordinateEmployeeIds: jest.fn(),
    findPropertyById: jest.fn(),
    inquiryCodeExists: jest.fn().mockResolvedValue(false),
    findRecentOpenByPhone: jest.fn().mockResolvedValue(null),
    createInquiry: jest.fn().mockResolvedValue('inq-1'),
    findById: jest.fn(),
    findBasicById: jest.fn(),
    buildWhere: jest.fn().mockReturnValue({ tenant_id: TENANT }),
    list: jest.fn(),
    updateInquiry: jest.fn(),
    softDelete: jest.fn(),
    changeStage: jest.fn(),
    assign: jest.fn(),
    addNote: jest.fn(),
    listNotes: jest.fn(),
    addFollowup: jest.fn(),
    listFollowups: jest.fn(),
    findFollowup: jest.fn(),
    updateFollowup: jest.fn(),
    addSiteVisit: jest.fn(),
    listSiteVisits: jest.fn(),
    findSiteVisit: jest.fn(),
    updateSiteVisit: jest.fn(),
    listHistory: jest.fn().mockResolvedValue([]),
    listActivities: jest.fn().mockResolvedValue([]),
    createLeadSource: jest.fn(),
    listLeadSources: jest.fn(),
    findLeadSourceById: jest.fn(),
    findLeadSourceByName: jest.fn(),
    updateLeadSource: jest.fn(),
    stageCounts: jest.fn().mockResolvedValue([]),
    countInquiries: jest.fn().mockResolvedValue(0),
    countSiteVisits: jest.fn().mockResolvedValue(0),
    topPerformer: jest.fn().mockResolvedValue(null),
    employeeName: jest.fn().mockResolvedValue(null),
  };
  const audit = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;

  const events = { emit: jest.fn(), on: jest.fn() } as any;

  const service = new CrmService(repo as unknown as CrmRepository, audit, events);
  return { service, repo, audit, events };
}

describe('CrmService — RBAC scope', () => {
  it('grants full scope to privileged roles', async () => {
    const { service, repo } = buildService();
    for (const role of ['super_admin', 'org_owner', 'org_admin']) {
      const scope: InquiryScope = await service.resolveScope(makeUser([role]), TENANT);
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

  it('scopes a sales_executive to self only', async () => {
    const { service, repo } = buildService();
    repo.findEmployeeByUserId!.mockResolvedValue({ id: 'emp-x' } as never);
    const scope = await service.resolveScope(makeUser(['sales_executive']), TENANT);
    expect(scope).toEqual({ type: 'employees', employeeIds: ['emp-x'] });
  });

  it('scopes a telecaller to self only', async () => {
    const { service, repo } = buildService();
    repo.findEmployeeByUserId!.mockResolvedValue({ id: 'emp-t' } as never);
    const scope = await service.resolveScope(makeUser(['telecaller']), TENANT);
    expect(scope).toEqual({ type: 'employees', employeeIds: ['emp-t'] });
  });

  it('returns empty scope when no employee record exists', async () => {
    const { service, repo } = buildService();
    repo.findEmployeeByUserId!.mockResolvedValue(null as never);
    const scope = await service.resolveScope(makeUser(['sales_executive']), TENANT);
    expect(scope).toEqual({ type: 'employees', employeeIds: [] });
  });
});

describe('CrmService — access enforcement', () => {
  it('hides out-of-scope inquiries as 404', async () => {
    const { service, repo } = buildService();
    repo.findById!.mockResolvedValue(
      makeInquiry({ assigned_employee_id: 'emp-other' }) as never,
    );
    repo.findEmployeeByUserId!.mockResolvedValue({ id: 'emp-me' } as never);
    await expect(
      service.getOne(TENANT, makeUser(['sales_executive']), 'inq-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows access to assigned inquiry', async () => {
    const { service, repo } = buildService();
    repo.findById!.mockResolvedValue(
      makeInquiry({ assigned_employee_id: 'emp-me' }) as never,
    );
    repo.findEmployeeByUserId!.mockResolvedValue({ id: 'emp-me' } as never);
    const result = await service.getOne(TENANT, makeUser(['sales_executive']), 'inq-1');
    expect(result.id).toBe('inq-1');
  });

  it('returns 404 for missing inquiry', async () => {
    const { service, repo } = buildService();
    repo.findById!.mockResolvedValue(null as never);
    await expect(
      service.getOne(TENANT, makeUser(['org_admin']), 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('CrmService — field-level PII stripping', () => {
  const sensitiveInquiry = () =>
    makeInquiry({
      assigned_employee_id: 'emp-me',
      remarks: 'Buyer shared Aadhaar scan in WhatsApp.',
      lost_reason: 'Sensitive reason',
      no_property_reason: 'Sensitive no-property note',
      notes: [
        {
          id: 'note-1',
          note: 'Client PAN is ABCDE1234F',
          created_by: 'user-1',
          created_by_email: 'owner@example.com',
          created_at: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
      followups: [
        {
          id: 'followup-1',
          followup_date: new Date('2026-01-03T00:00:00.000Z'),
          followup_time: '10:00',
          followup_type: 'call',
          status: 'pending',
          notes: 'Discuss loan docs',
          completed_at: null,
          assigned_employee_id: 'emp-me',
          created_at: new Date('2026-01-02T00:00:00.000Z'),
          employee: null,
        },
      ],
      site_visits: [
        {
          id: 'visit-1',
          scheduled_at: new Date('2026-01-04T10:00:00.000Z'),
          completed_at: null,
          status: 'scheduled',
          notes: 'Meet at home address',
          property_id: null,
          employee_id: 'emp-me',
          created_at: new Date('2026-01-02T00:00:00.000Z'),
          employee: null,
          property: null,
        },
      ],
    });

  it('keeps full CRM PII visible for admins', async () => {
    const { service, repo } = buildService();
    repo.findById!.mockResolvedValue(sensitiveInquiry() as never);

    const result = await service.getOne(TENANT, makeUser(['org_admin']), 'inq-1');

    expect(result.phone).toBe('+919876543210');
    expect(result.email).toBe('rahul@example.com');
    expect(result.lead_score).toBe(60);
    expect(result.budget_min).toBe(5000000);
    expect(result.remarks).toContain('Aadhaar');
    expect(result.notes[0].note).toContain('PAN');
    expect(result.followups[0].notes).toBe('Discuss loan docs');
    expect(result.site_visits[0].notes).toBe('Meet at home address');
  });

  it('keeps assigned sales executives operational lead details', async () => {
    const { service, repo } = buildService();
    repo.findById!.mockResolvedValue(sensitiveInquiry() as never);
    repo.findEmployeeByUserId!.mockResolvedValue({ id: 'emp-me' } as never);

    const result = await service.getOne(TENANT, makeUser(['sales_executive']), 'inq-1');

    expect(result.phone).toBe('+919876543210');
    expect(result.email).toBe('rahul@example.com');
    expect(result.lead_score).toBe(60);
    expect(result.remarks).toContain('Aadhaar');
    expect(result.notes[0].note).toContain('PAN');
  });

  it('strips internal CRM PII for telecallers while keeping dialable contact fields', async () => {
    const { service, repo } = buildService();
    repo.findById!.mockResolvedValue(sensitiveInquiry() as never);
    repo.findEmployeeByUserId!.mockResolvedValue({ id: 'emp-me' } as never);

    const result = await service.getOne(TENANT, makeUser(['telecaller']), 'inq-1');

    expect(result.client_name).toBe('Rahul Sharma');
    expect(result.phone).toBe('+919876543210');
    expect(result.whatsapp).toBeNull();
    expect(result.email).toBeNull();
    expect(result.lead_score).toBeNull();
    expect(result.budget_min).toBeNull();
    expect(result.budget_max).toBeNull();
    expect(result.booking_amount).toBeNull();
    expect(result.expected_commission).toBeNull();
    expect(result.received_commission).toBeNull();
    expect(result.commission_status).toBeNull();
    expect(result.remarks).toBeNull();
    expect(result.lost_reason).toBeNull();
    expect(result.no_property_reason).toBeNull();
    expect(result.created_by).toBeNull();
    expect(result.notes[0]).toEqual({
      id: 'note-1',
      note: null,
      created_by: null,
      created_by_email: null,
      created_at: '2026-01-02T00:00:00.000Z',
    });
    expect(result.followups[0].notes).toBeNull();
    expect(result.site_visits[0].notes).toBeNull();
  });

  it('strips note list content for telecallers', async () => {
    const { service, repo } = buildService();
    repo.findBasicById!.mockResolvedValue(sensitiveInquiry() as never);
    repo.findEmployeeByUserId!.mockResolvedValue({ id: 'emp-me' } as never);
    repo.listNotes!.mockResolvedValue([
      {
        id: 'note-1',
        note: 'Client PAN is ABCDE1234F',
        created_by: 'user-1',
        created_by_email: 'owner@example.com',
        created_at: new Date('2026-01-02T00:00:00.000Z'),
      },
    ] as never);

    const result = await service.listNotes(TENANT, makeUser(['telecaller']), 'inq-1');

    expect(result).toEqual([
      {
        id: 'note-1',
        note: null,
        created_by: null,
        created_by_email: null,
        created_at: '2026-01-02T00:00:00.000Z',
      },
    ]);
  });
});

describe('CrmService — create', () => {
  it('rejects budget_max < budget_min (BR-C08)', async () => {
    const { service } = buildService();
    await expect(
      service.create(
        TENANT,
        { client_name: 'A', phone: '+91999', budget_min: 100, budget_max: 50 } as never,
        makeUser(['org_admin']),
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('blocks duplicate open inquiry by phone (BR-C01)', async () => {
    const { service, repo } = buildService();
    repo.findRecentOpenByPhone!.mockResolvedValue({
      id: 'inq-old',
      inquiry_code: 'INQ-OLD',
      created_at: new Date(),
    } as never);
    await expect(
      service.create(
        TENANT,
        { client_name: 'A', phone: '+919876543210' } as never,
        makeUser(['org_admin']),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows duplicate when override_duplicate set', async () => {
    const { service, repo } = buildService();
    repo.findRecentOpenByPhone!.mockResolvedValue({ id: 'x', inquiry_code: 'y' } as never);
    repo.findById!.mockResolvedValue(makeInquiry() as never);
    const result = await service.create(
      TENANT,
      { client_name: 'A', phone: '+919876543210', override_duplicate: true } as never,
      makeUser(['org_admin']),
    );
    expect(repo.findRecentOpenByPhone).not.toHaveBeenCalled();
    expect(repo.createInquiry).toHaveBeenCalled();
    expect(result.inquiry_code).toBe('INQ-ABC123');
  });

  it('rejects an invalid property_id', async () => {
    const { service, repo } = buildService();
    repo.findPropertyById!.mockResolvedValue(null as never);
    await expect(
      service.create(
        TENANT,
        { client_name: 'A', phone: '+91999', property_id: 'bad' } as never,
        makeUser(['org_admin']),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates inquiry and writes audit', async () => {
    const { service, repo, audit } = buildService();
    repo.findById!.mockResolvedValue(makeInquiry() as never);
    const result = await service.create(
      TENANT,
      { client_name: 'Rahul Sharma', phone: '+919876543210' } as never,
      makeUser(['org_admin']),
    );
    expect(repo.createInquiry).toHaveBeenCalled();
    expect(result.stage).toBe('NEW');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'crm.inquiry.created' }),
    );
  });
});

describe('CrmService — stage workflow', () => {
  it('blocks invalid transition for non-privileged role (BR-C02)', async () => {
    const { service, repo } = buildService();
    repo.findById!.mockResolvedValue(makeInquiry({ stage: 'NEW', assigned_employee_id: 'emp-me' }) as never);
    repo.findEmployeeByUserId!.mockResolvedValue({ id: 'emp-me' } as never);
    await expect(
      service.changeStage(TENANT, makeUser(['sales_executive']), 'inq-1', { stage: 'BOOKED' } as never),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('allows managers to jump stages', async () => {
    const { service, repo } = buildService();
    repo.findById!.mockResolvedValue(makeInquiry({ stage: 'NEW' }) as never);
    await service.changeStage(TENANT, makeUser(['org_admin']), 'inq-1', { stage: 'NEGOTIATION' } as never);
    expect(repo.changeStage).toHaveBeenCalledWith(
      expect.objectContaining({ fromStage: 'NEW', toStage: 'NEGOTIATION' }),
    );
  });

  it('persists deal economics when moving to BOOKED', async () => {
    const { service, repo } = buildService();
    repo.findById!.mockResolvedValue(makeInquiry({ stage: 'NEGOTIATION' }) as never);
    await service.changeStage(
      TENANT,
      makeUser(['org_admin']),
      'inq-1',
      {
        stage: 'BOOKED',
        booking_amount: 100000,
        expected_commission: 250000,
        commission_status: 'pending',
      } as never,
    );
    expect(repo.changeStage).toHaveBeenCalledWith(
      expect.objectContaining({
        toStage: 'BOOKED',
        data: expect.objectContaining({
          booking_amount: 100000,
          expected_commission: 250000,
          commission_status: 'pending',
        }),
      }),
    );
  });

  it('requires property or reason for CLOSED_WON (BR-C03)', async () => {
    const { service, repo } = buildService();
    repo.findById!.mockResolvedValue(makeInquiry({ stage: 'BOOKED', property_id: null }) as never);
    await expect(
      service.changeStage(TENANT, makeUser(['org_admin']), 'inq-1', { stage: 'CLOSED_WON' } as never),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('allows CLOSED_WON with a linked property', async () => {
    const { service, repo } = buildService();
    repo.findById!.mockResolvedValue(makeInquiry({ stage: 'BOOKED', property_id: 'prop-1' }) as never);
    await service.changeStage(TENANT, makeUser(['org_admin']), 'inq-1', { stage: 'CLOSED_WON' } as never);
    expect(repo.changeStage).toHaveBeenCalledWith(
      expect.objectContaining({ activityType: 'closed_won' }),
    );
  });

  it('requires lost_reason for CLOSED_LOST (BR-C04)', async () => {
    const { service, repo } = buildService();
    repo.findById!.mockResolvedValue(makeInquiry({ stage: 'CONTACTED' }) as never);
    await expect(
      service.changeStage(TENANT, makeUser(['org_admin']), 'inq-1', { stage: 'CLOSED_LOST' } as never),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('closes lost with a reason', async () => {
    const { service, repo } = buildService();
    repo.findById!.mockResolvedValue(makeInquiry({ stage: 'CONTACTED' }) as never);
    await service.changeStage(
      TENANT,
      makeUser(['org_admin']),
      'inq-1',
      { stage: 'CLOSED_LOST', lost_reason: 'Budget mismatch' } as never,
    );
    expect(repo.changeStage).toHaveBeenCalledWith(
      expect.objectContaining({ activityType: 'closed_lost' }),
    );
  });
});

describe('CrmService — assignment', () => {
  it('rejects invalid employee', async () => {
    const { service, repo } = buildService();
    repo.findById!.mockResolvedValue(makeInquiry() as never);
    repo.findEmployeeById!.mockResolvedValue(null as never);
    await expect(
      service.assign(TENANT, makeUser(['org_admin']), 'inq-1', { employee_id: 'bad' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('assigns and records history', async () => {
    const { service, repo, audit } = buildService();
    repo.findById!.mockResolvedValue(makeInquiry() as never);
    repo.findEmployeeById!.mockResolvedValue({ id: 'emp-1' } as never);
    await service.assign(TENANT, makeUser(['org_admin']), 'inq-1', { employee_id: 'emp-1' } as never);
    expect(repo.assign).toHaveBeenCalledWith(expect.objectContaining({ employeeId: 'emp-1' }));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'crm.inquiry.assigned' }),
    );
  });
});

describe('CrmService — follow-ups & site visits', () => {
  it('creates a follow-up', async () => {
    const { service, repo } = buildService();
    repo.findBasicById!.mockResolvedValue(makeInquiry({ assigned_employee_id: null }) as never);
    repo.addFollowup!.mockResolvedValue({
      id: 'f1',
      followup_date: new Date('2026-06-15'),
      followup_time: '15:30',
      followup_type: 'call',
      status: 'pending',
      notes: null,
      completed_at: null,
      assigned_employee_id: null,
      created_at: new Date(),
    } as never);
    repo.findFollowup!.mockResolvedValue(null as never);
    const result = await service.addFollowup(
      TENANT,
      makeUser(['org_admin']),
      'inq-1',
      { followup_date: '2026-06-15', followup_time: '15:30', followup_type: 'call' } as never,
    );
    expect(result.followup_type).toBe('call');
  });

  it('marks a follow-up completed', async () => {
    const { service, repo } = buildService();
    repo.findBasicById!.mockResolvedValue(makeInquiry() as never);
    repo.findFollowup!.mockResolvedValue({ id: 'f1', status: 'pending' } as never);
    repo.updateFollowup!.mockResolvedValue({
      id: 'f1',
      followup_date: new Date('2026-06-15'),
      followup_time: null,
      followup_type: 'call',
      status: 'completed',
      notes: null,
      completed_at: new Date(),
      assigned_employee_id: null,
      created_at: new Date(),
      employee: null,
    } as never);
    const result = await service.updateFollowup(
      TENANT,
      makeUser(['org_admin']),
      'inq-1',
      'f1',
      { status: 'completed' } as never,
    );
    expect(result.status).toBe('completed');
  });

  it('schedules a site visit', async () => {
    const { service, repo } = buildService();
    repo.findBasicById!.mockResolvedValue(makeInquiry({ property_id: 'prop-1', assigned_employee_id: 'emp-1' }) as never);
    repo.findPropertyById!.mockResolvedValue({ id: 'prop-1' } as never);
    repo.findEmployeeById!.mockResolvedValue({ id: 'emp-1' } as never);
    repo.addSiteVisit!.mockResolvedValue({
      id: 'sv1',
      scheduled_at: new Date('2026-06-18T10:30:00.000Z'),
      completed_at: null,
      status: 'scheduled',
      notes: null,
      property_id: 'prop-1',
      employee_id: 'emp-1',
      created_at: new Date(),
    } as never);
    repo.findSiteVisit!.mockResolvedValue(null as never);
    const result = await service.addSiteVisit(
      TENANT,
      makeUser(['org_admin']),
      'inq-1',
      { scheduled_at: '2026-06-18T10:30:00.000Z' } as never,
    );
    expect(result.status).toBe('scheduled');
  });
});

describe('CrmService — soft delete & list', () => {
  it('soft deletes an inquiry', async () => {
    const { service, repo, audit } = buildService();
    repo.findById!.mockResolvedValue(makeInquiry() as never);
    repo.softDelete!.mockResolvedValue(true as never);
    const result = await service.remove(TENANT, makeUser(['org_admin']), 'inq-1');
    expect(result).toEqual({ id: 'inq-1', deleted: true });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'crm.inquiry.deleted' }),
    );
  });

  it('lists with scope + pagination meta', async () => {
    const { service, repo } = buildService();
    repo.list!.mockResolvedValue({ rows: [makeInquiry()], total: 1 } as never);
    const result = await service.list(TENANT, makeUser(['org_admin']), { page: 1, per_page: 20 } as never);
    expect(result.data).toHaveLength(1);
    expect(result.meta).toEqual({ page: 1, per_page: 20, total: 1, total_pages: 1 });
  });
});

describe('CrmService — lead sources & metrics', () => {
  it('rejects duplicate lead source name', async () => {
    const { service, repo } = buildService();
    repo.findLeadSourceByName!.mockResolvedValue({ id: 'ls1' } as never);
    await expect(
      service.createLeadSource(TENANT, makeUser(['org_admin']), { name: 'Website' } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a lead source', async () => {
    const { service, repo } = buildService();
    repo.findLeadSourceByName!.mockResolvedValue(null as never);
    repo.createLeadSource!.mockResolvedValue({
      id: 'ls1',
      name: 'Website',
      code: 'website',
      is_active: true,
      is_system: false,
      created_at: new Date(),
    } as never);
    const result = await service.createLeadSource(
      TENANT,
      makeUser(['org_admin']),
      { name: 'Website' } as never,
    );
    expect(result.name).toBe('Website');
  });

  it('computes pipeline metrics + conversion rate', async () => {
    const { service, repo } = buildService();
    repo.stageCounts!.mockResolvedValue([
      { stage: 'NEW', _count: { _all: 4 } },
      { stage: 'QUALIFIED', _count: { _all: 3 } },
      { stage: 'CLOSED_WON', _count: { _all: 2 } },
      { stage: 'CLOSED_LOST', _count: { _all: 1 } },
    ] as never);
    repo.countInquiries!.mockResolvedValue(10 as never);
    repo.countSiteVisits!.mockResolvedValue(5 as never);
    const result = await service.getMetrics(TENANT, makeUser(['org_admin']));
    expect(result.total_leads).toBe(10);
    expect(result.won_deals).toBe(2);
    expect(result.lost_deals).toBe(1);
    expect(result.qualified_leads).toBe(5); // QUALIFIED(3) + CLOSED_WON(2)
    expect(result.site_visits).toBe(5);
    expect(result.conversion_rate).toBe(20);
  });
});
