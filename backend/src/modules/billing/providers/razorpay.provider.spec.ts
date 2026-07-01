import { RazorpayProvider } from './razorpay.provider';
import type { PlatformPaymentConfigService } from '../../platform-settings/platform-payment-config.service';

describe('RazorpayProvider', () => {
  const originalEnv = process.env;
  const fetchMock = jest.fn();

  function createProvider(credentials: {
    keyId: string;
    keySecret: string;
    webhookSecret?: string;
  } | null) {
    const paymentConfig = {
      getActiveRazorpayCredentials: jest.fn().mockResolvedValue(
        credentials
          ? {
              keyId: credentials.keyId,
              keySecret: credentials.keySecret,
              webhookSecret: credentials.webhookSecret ?? '',
              environment: 'test' as const,
              source: 'environment' as const,
            }
          : null,
      ),
    } as unknown as PlatformPaymentConfigService;

    return new RazorpayProvider(paymentConfig);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    global.fetch = fetchMock;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('requires Razorpay credentials for live subscription creation', async () => {
    const provider = createProvider(null);

    await expect(
      provider.createSubscription({
        tenantId: 'tenant-1',
        planCode: 'pro',
        planName: 'Pro',
        billingCycle: 'monthly',
        amount: 1499900,
        currency: 'INR',
      }),
    ).rejects.toThrow('Razorpay credentials are not configured');
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

    const provider = createProvider({
      keyId: 'rzp_test_key',
      keySecret: 'rzp_test_secret',
    });
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

    const provider = createProvider({
      keyId: 'rzp_test_key',
      keySecret: 'rzp_test_secret',
    });
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
