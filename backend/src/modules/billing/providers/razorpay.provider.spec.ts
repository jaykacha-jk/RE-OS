import { RazorpayProvider } from './razorpay.provider';

describe('RazorpayProvider', () => {
  const originalEnv = process.env;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      PAYMENT_PROVIDER: 'razorpay',
      RAZORPAY_KEY_ID: 'rzp_test_key',
      RAZORPAY_KEY_SECRET: 'rzp_test_secret',
    };
    global.fetch = fetchMock;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('requires Razorpay credentials for live subscription creation', async () => {
    delete process.env.RAZORPAY_KEY_SECRET;
    const provider = new RazorpayProvider();

    await expect(
      provider.createSubscription({
        tenantId: 'tenant-1',
        planCode: 'pro',
        planName: 'Pro',
        billingCycle: 'monthly',
        amount: 1499900,
        currency: 'INR',
      }),
    ).rejects.toThrow('RAZORPAY_KEY_SECRET is required when PAYMENT_PROVIDER=razorpay');
  });

  it('creates a Razorpay plan then subscription and returns the hosted checkout link', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'plan_RZP123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'sub_RZP123',
          short_url: 'https://rzp.io/i/subscription123',
        }),
      });

    const provider = new RazorpayProvider();
    const result = await provider.createSubscription({
      tenantId: 'tenant-1',
      planCode: 'pro',
      planName: 'Pro',
      billingCycle: 'monthly',
      amount: 1499900,
      currency: 'INR',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.razorpay.com/v1/plans',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /),
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          period: 'monthly',
          interval: 1,
          item: {
            name: 'RE-OS Pro monthly',
            amount: 1499900,
            currency: 'INR',
            description: 'Pro plan for RE-OS',
          },
          notes: {
            tenant_id: 'tenant-1',
            plan_code: 'pro',
            billing_cycle: 'monthly',
          },
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.razorpay.com/v1/subscriptions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          plan_id: 'plan_RZP123',
          total_count: 120,
          quantity: 1,
          customer_notify: 1,
          notes: {
            tenant_id: 'tenant-1',
            plan_code: 'pro',
            billing_cycle: 'monthly',
            provider_plan_id: 'plan_RZP123',
          },
        }),
      }),
    );
    expect(result).toEqual({
      provider: 'razorpay',
      providerSubscriptionId: 'sub_RZP123',
      checkoutUrl: 'https://rzp.io/i/subscription123',
      metadata: {
        tenantId: 'tenant-1',
        planCode: 'pro',
        billingCycle: 'monthly',
        providerPlanId: 'plan_RZP123',
      },
    });
  });

  it('surfaces Razorpay API errors', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: { description: 'Plan amount is invalid' },
      }),
    });

    const provider = new RazorpayProvider();
    await expect(
      provider.createSubscription({
        tenantId: 'tenant-1',
        planCode: 'pro',
        planName: 'Pro',
        billingCycle: 'monthly',
        amount: 1499900,
        currency: 'INR',
      }),
    ).rejects.toThrow('Plan amount is invalid');
  });
});
