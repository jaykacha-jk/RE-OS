import { BillingRepository } from './billing.repository';

describe('BillingRepository tenant isolation', () => {
  function setup(txOverrides: Record<string, unknown> = {}) {
    const subscription = { id: 'subscription-1' };
    const tx = {
      subscriptions: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue(subscription),
        findFirst: jest.fn().mockResolvedValue(subscription),
      },
      organizations: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      ...txOverrides,
    };
    const db = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      invoices: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      payments: { create: jest.fn().mockResolvedValue({ id: 'payment-1' }) },
    };
    const repo = new BillingRepository({ dbClient: db } as never);
    return { repo, db, tx };
  }

  it('replaces subscriptions only inside the tenant', async () => {
    const { repo, tx } = setup();

    await repo.createOrReplaceSubscription({
      tenantId: 'tenant-1',
      planId: 'plan-1',
      planCode: 'pro',
      status: 'trial',
      billingCycle: 'monthly',
      provider: 'razorpay',
      providerSubscriptionId: 'sub-rzp-1',
      periodStart: new Date('2026-01-01T00:00:00.000Z'),
      periodEnd: new Date('2026-02-01T00:00:00.000Z'),
      actorId: 'user-1',
    });

    expect(tx.subscriptions.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant_id: 'tenant-1', deleted_at: null },
      }),
    );
    expect(tx.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenant_id: 'tenant-1' }),
      }),
    );
    expect(tx.organizations.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tenant-1', deleted_at: null },
      }),
    );
  });

  it('updates subscriptions with tenant and subscription id predicates', async () => {
    const { repo, tx } = setup();

    await repo.updateSubscription({
      tenantId: 'tenant-1',
      subscriptionId: 'subscription-1',
      data: { status: 'active' },
      orgStatus: 'active',
    });

    expect(tx.subscriptions.updateMany).toHaveBeenCalledWith({
      where: { id: 'subscription-1', tenant_id: 'tenant-1', deleted_at: null },
      data: { status: 'active' },
    });
    expect(tx.subscriptions.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'subscription-1', tenant_id: 'tenant-1', deleted_at: null },
      }),
    );
    expect(tx.organizations.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tenant-1', deleted_at: null },
      }),
    );
  });

  it('lists invoices only for the current tenant', async () => {
    const { repo, db } = setup();

    await repo.listInvoices('tenant-1', 1, 20);

    expect(db.invoices.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant_id: 'tenant-1', deleted_at: null },
      }),
    );
    expect(db.invoices.count).toHaveBeenCalledWith({
      where: { tenant_id: 'tenant-1', deleted_at: null },
    });
  });

  it('creates payments with tenant id from the trusted subscription context', async () => {
    const { repo, db } = setup();

    await repo.createPayment({
      tenantId: 'tenant-1',
      subscriptionId: 'subscription-1',
      provider: 'razorpay',
      amount: 1000,
      status: 'captured',
    });

    expect(db.payments.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenant_id: 'tenant-1',
          subscription_id: 'subscription-1',
        }),
      }),
    );
  });
});
