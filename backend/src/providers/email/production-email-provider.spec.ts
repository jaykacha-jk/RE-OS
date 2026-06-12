import { ProductionEmailProvider } from './production-email-provider';

const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

describe('ProductionEmailProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      EMAIL_PROVIDER: 'production',
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'RE-OS <noreply@example.com>',
      EMAIL_REPLY_TO: 'support@example.com',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('validates required Resend configuration in production mode', () => {
    delete process.env.RESEND_API_KEY;
    const provider = new ProductionEmailProvider();

    expect(() => provider.onModuleInit()).toThrow(
      'RESEND_API_KEY is required when EMAIL_PROVIDER=production',
    );
  });

  it('sends email through Resend and maps the provider result', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email_123' }, error: null });
    const provider = new ProductionEmailProvider();
    provider.onModuleInit();

    const result = await provider.send({
      to: 'owner@example.com',
      subject: 'Welcome',
      text: 'Hello',
      html: '<p>Hello</p>',
      tenantId: 'tenant_1',
    });

    expect(mockSend).toHaveBeenCalledWith({
      from: 'RE-OS <noreply@example.com>',
      to: 'owner@example.com',
      subject: 'Welcome',
      text: 'Hello',
      html: '<p>Hello</p>',
      replyTo: 'support@example.com',
    });
    expect(result).toEqual({
      messageId: 'email_123',
      provider: 'resend',
      accepted: true,
    });
  });

  it('throws provider errors so the queue can retry', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'domain is not verified' },
    });
    const provider = new ProductionEmailProvider();
    provider.onModuleInit();

    await expect(
      provider.send({
        to: 'owner@example.com',
        subject: 'Welcome',
        text: 'Hello',
      }),
    ).rejects.toThrow('Resend email delivery failed: domain is not verified');
  });
});
