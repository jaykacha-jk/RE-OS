import { BillingService } from './billing.service';

describe('BillingService', () => {
  const originalEnv = process.env;
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
      findWebhookEvent: jest.fn().mockResolvedValue(null),
      createWebhookEvent: jest.fn().mockResolvedValue({ id: 'event-row-1' }),
      markWebhookProcessed: jest.fn().mockResolvedValue(undefined),
      markWebhookFailed: jest.fn().mockResolvedValue(undefined),
      findSubscriptionByProviderId: jest.fn().mockResolvedValue({
        id: 'sub-1',
        tenant_id: 'tenant-1',
        plan_id: 'plan-pro',
        status: 'trial',
        billing_cycle: 'monthly',
        provider: 'razorpay',
        provider_subscription_id: 'rzp-sub-1',
        current_period_end: new Date(),
        plan,
      }),
      updateSubscription: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
    const mockProvider = {
      createSubscription: jest.fn().mockResolvedValue({
        provider: 'mock',
        providerSubscriptionId: 'mock-sub-1',
        checkoutUrl: 'http://checkout.test',
      }),
    };
    const razorpayProvider = {
      createSubscription: jest.fn().mockResolvedValue({
        provider: 'razorpay',
        providerSubscriptionId: 'sub-rzp-1',
        checkoutUrl: 'https://rzp.io/i/subscription123',
      }),
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const events = { emit: jest.fn() };

    const service = new BillingService(
      repo as never,
      mockProvider as never,
      razorpayProvider as never,
      audit as never,
      events as never,
    );
    return { service, repo, mockProvider, razorpayProvider, audit, events };
  }

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

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

  it('creates paid checkout through Razorpay when configured', async () => {
    process.env.PAYMENT_PROVIDER = 'razorpay';
    const { service, repo, mockProvider, razorpayProvider } = setup();

    const result = await service.subscribe(
      'tenant-1',
      { plan_code: 'pro', billing_cycle: 'monthly' },
      { userId: 'user-1', tenantId: 'tenant-1', roles: ['org_owner'], permissions: [] },
    );

    expect(mockProvider.createSubscription).not.toHaveBeenCalled();
    expect(razorpayProvider.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ planCode: 'pro', amount: 1499900 }),
    );
    expect(repo.createOrReplaceSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'razorpay',
        providerSubscriptionId: 'sub-rzp-1',
        status: 'trial',
      }),
    );
    expect(result.checkout).toEqual({
      provider: 'razorpay',
      subscription_id: 'sub-rzp-1',
      checkout_url: 'https://rzp.io/i/subscription123',
    });
  });

  it('activates zero-priced plans without calling a payment provider', async () => {
    const freePlan = {
      ...plan,
      code: 'enterprise',
      price_inr_monthly: 0,
      price_inr_yearly: 0,
    };
    const { service, repo, mockProvider, razorpayProvider } = setup({
      findPlanByCode: jest.fn().mockResolvedValue(freePlan),
    });

    const result = await service.subscribe(
      'tenant-1',
      { plan_code: 'enterprise', billing_cycle: 'monthly' },
      { userId: 'user-1', tenantId: 'tenant-1', roles: ['org_owner'], permissions: [] },
    );

    expect(mockProvider.createSubscription).not.toHaveBeenCalled();
    expect(razorpayProvider.createSubscription).not.toHaveBeenCalled();
    expect(repo.createOrReplaceSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'manual',
        status: 'active',
        trialEndsAt: null,
      }),
    );
    expect(result.checkout.checkout_url).toBeNull();
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

  it('verifies Razorpay webhooks against the raw body and marks success processed', async () => {
    const { service, repo } = setup();
    const rawBody = Buffer.from('{"id":"evt-1","event":"subscription.activated","payload":{}}');
    const dto = {
      id: 'evt-1',
      event: 'subscription.activated',
      payload: { subscription: { entity: { id: 'rzp-sub-1' } } },
    };

    await expect(service.processRazorpayWebhook(dto, 'sig', rawBody)).resolves.toEqual({
      processed: true,
      duplicate: false,
    });

    expect(repo.createWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({ providerEventId: 'evt-1', signatureValid: true }),
    );
    expect(repo.markWebhookProcessed).toHaveBeenCalledWith('event-row-1');
    expect(repo.markWebhookFailed).not.toHaveBeenCalled();
  });

  it('keeps failed Razorpay webhooks retryable', async () => {
    const { service, repo } = setup({
      findSubscriptionByProviderId: jest.fn().mockResolvedValue(null),
    });
    const dto = {
      id: 'evt-failed',
      event: 'subscription.activated',
      payload: { subscription: { entity: { id: 'rzp-sub-missing' } } },
    };

    await expect(service.processRazorpayWebhook(dto, 'sig', Buffer.from('{}'))).rejects.toThrow(
      'Subscription not found',
    );

    expect(repo.markWebhookFailed).toHaveBeenCalledWith(
      'event-row-1',
      'Subscription not found for webhook',
    );
    expect(repo.markWebhookProcessed).not.toHaveBeenCalled();
  });
});
