import { CrmRepository } from './crm.repository';

describe('CrmRepository tenant isolation', () => {
  function setup(txOverrides: Record<string, unknown> = {}) {
    const tx = {
      inquiries: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      inquiry_history: { create: jest.fn().mockResolvedValue({}) },
      inquiry_activities: { create: jest.fn().mockResolvedValue({}) },
      site_visits: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue({ id: 'visit-1' }),
      },
      ...txOverrides,
    };
    const db = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      inquiries: {
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      inquiry_followups: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue({ id: 'followup-1' }),
      },
    };
    const repo = new CrmRepository({ dbClient: db } as never);
    return { repo, db, tx };
  }

  it('builds inquiry list predicates with tenant and deleted filters', () => {
    const { repo } = setup();

    expect(repo.buildWhere('tenant-1', {}, { type: 'all' })).toEqual({
      tenant_id: 'tenant-1',
      deleted_at: null,
    });
  });

  it('rejects list predicates that are missing tenant scope', async () => {
    const { repo } = setup();

    await expect(
      repo.list({
        where: { deleted_at: null },
        sortBy: 'created_at',
        sortDir: 'desc',
        page: 1,
        perPage: 10,
      }),
    ).rejects.toThrow('CrmRepository.list must include tenant_id');
  });

  it('scopes inquiry update and history writes by tenant', async () => {
    const { repo, tx } = setup();

    await repo.updateInquiry({
      tenantId: 'tenant-1',
      id: 'inquiry-1',
      data: { priority: 'high' },
      historyEntries: [
        {
          change_type: 'updated',
          changed_fields: { priority: 'high' },
        },
      ],
    });

    expect(tx.inquiries.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inquiry-1', tenant_id: 'tenant-1', deleted_at: null },
      }),
    );
    expect(tx.inquiry_history.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenant_id: 'tenant-1',
          inquiry_id: 'inquiry-1',
        }),
      }),
    );
  });

  it('scopes follow-up updates by tenant and parent inquiry', async () => {
    const { repo, db } = setup();

    await repo.updateFollowup('tenant-1', 'inquiry-1', 'followup-1', { status: 'completed' });

    expect(db.inquiry_followups.updateMany).toHaveBeenCalledWith({
      where: { id: 'followup-1', tenant_id: 'tenant-1', inquiry_id: 'inquiry-1' },
      data: { status: 'completed' },
    });
    expect(db.inquiry_followups.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'followup-1', tenant_id: 'tenant-1', inquiry_id: 'inquiry-1' },
      }),
    );
  });

  it('scopes site-visit updates by tenant and parent inquiry', async () => {
    const { repo, tx } = setup();

    await repo.updateSiteVisit({
      tenantId: 'tenant-1',
      inquiryId: 'inquiry-1',
      visitId: 'visit-1',
      data: { status: 'completed' },
      markCompleted: false,
    });

    expect(tx.site_visits.updateMany).toHaveBeenCalledWith({
      where: { id: 'visit-1', tenant_id: 'tenant-1', inquiry_id: 'inquiry-1' },
      data: { status: 'completed' },
    });
    expect(tx.site_visits.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'visit-1', tenant_id: 'tenant-1', inquiry_id: 'inquiry-1' },
      }),
    );
  });
});
