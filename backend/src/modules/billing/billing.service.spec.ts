import { BillingService } from './billing.service';

describe('BillingService', () => {
  const plan = {
    id: 'plan-pro',
    code: 'pro',
    name: 'Pro',
    price_inr_monthly: 1499900,
    price_inr_yearly: 14999000,
    max_properties: 1000,
    max_employees: 25,
    storage_limit_bytes: 53687091200n,
    max_ai_minutes_monthly: 0,
    features: { chat: true },
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  function setup(overrides: Record<string, unknown> = {}) {
    const repo = {
      listPlans: jest.fn().mockResolvedValue([plan]),
      findPlanByCode: jest.fn().mockResolvedValue(plan),
      findOrganization: jest.fn().mockResolvedValue({
        id: 'tenant-1',
        tier: 'pro',
        organization_usage: {
          properties_count: 12,
          employees_count: 3,
          storage_bytes: 1024n,
          ai_minutes_used: 0,
        },
      }),
      createOrReplaceSubscription: jest.fn().mockImplementation(async (input) => ({
        id: 'sub-1',
        tenant_id: input.tenantId,
        plan_id: input.planId,
        status: input.status,
        billing_cycle: input.billingCycle,
        provider: input.provider,
        provider_subscription_id: input.providerSubscriptionId,
        provider_customer_id: null,
        current_period_start: input.periodStart,
        current_period_end: input.periodEnd,
        trial_ends_at: input.trialEndsAt,
        cancel_at_period_end: false,
        cancelled_at: null,
        created_by: input.actorId,
        updated_by: input.actorId,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      })),
      ...overrides,
    };
    const mockProvider = {
      createSubscription: jest.fn().mockResolvedValue({
        provider: 'mock',
        providerSubscriptionId: 'mock-sub-1',
        checkoutUrl: 'http://checkout.test',
      }),
    };
    const razorpayProvider = { verifyWebhookSignature: jest.fn().mockReturnValue(true) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const events = { emit: jest.fn() };

    const service = new BillingService(
      repo as never,
      mockProvider as never,
      razorpayProvider as never,
      audit as never,
      events as never,
    );
    return { service, repo, mockProvider, audit, events };
  }

  it('lists plans with Phase 7 limits', async () => {
    const { service } = setup();

    await expect(service.listPlans()).resolves.toEqual([
      expect.objectContaining({
        code: 'pro',
        monthly_price: 1499900,
        property_limit: 1000,
        employee_limit: 25,
        storage_limit: 53687091200,
      }),
    ]);
  });

  it('creates a trial subscription through the payment provider', async () => {
    const { service, repo, mockProvider, audit, events } = setup();

    const result = await service.subscribe(
      'tenant-1',
      { plan_code: 'pro', billing_cycle: 'monthly' },
      { userId: 'user-1', tenantId: 'tenant-1', roles: ['org_owner'], permissions: [] },
    );

    expect(mockProvider.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ planCode: 'pro', amount: 1499900 }),
    );
    expect(repo.createOrReplaceSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'trial', providerSubscriptionId: 'mock-sub-1' }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'billing.subscription.created' }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      'billing.trial_ending',
      expect.objectContaining({ tenantId: 'tenant-1' }),
    );
    expect(result.checkout.checkout_url).toBe('http://checkout.test');
  });

  it('returns usage against current plan limits', async () => {
    const { service } = setup();

    await expect(service.getUsage('tenant-1')).resolves.toEqual(
      expect.objectContaining({
        usage: {
          properties: 12,
          employees: 3,
          storage_bytes: 1024,
          ai_minutes: 0,
        },
        limits: {
          properties: 1000,
          employees: 25,
          storage_bytes: 53687091200,
          ai_minutes: 0,
        },
      }),
    );
  });
});
