import { BadRequestException } from '@nestjs/common';

import { SecretCipherService } from '../../common/security/secret-cipher.service';
import { PlatformPaymentConfigService } from './platform-payment-config.service';
import type { PlatformSettingsRepository } from './platform-settings.repository';

describe('PlatformPaymentConfigService', () => {
  const key = 'b'.repeat(64);

  beforeEach(() => {
    process.env.PLATFORM_SECRETS_ENCRYPTION_KEY = key;
    process.env.RAZORPAY_KEY_ID = '';
    process.env.RAZORPAY_KEY_SECRET = '';
  });

  function setup() {
    const cipher = new SecretCipherService();
    const repo = {
      findByKey: jest.fn(),
      upsertEncrypted: jest.fn(),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new PlatformPaymentConfigService(
      repo as unknown as PlatformSettingsRepository,
      cipher,
      audit as never,
    );
    return { service, repo, audit, cipher };
  }

  it('returns masked env-backed config when database row is absent', async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_ABC12345';
    process.env.RAZORPAY_KEY_SECRET = 'secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec';

    const { service, repo } = setup();
    repo.findByKey.mockResolvedValue(null);

    const masked = await service.getMaskedRazorpayConfig();
    expect(masked.source).toBe('environment');
    expect(masked.key_id_masked).toContain('rzp_test');
    expect(masked.key_secret_configured).toBe(true);
  });

  it('stores encrypted config and audits without secret values', async () => {
    const { service, repo, audit } = setup();
    repo.findByKey.mockResolvedValue(null);
    repo.upsertEncrypted.mockResolvedValue({
      version: 1,
      updated_at: new Date('2026-06-19T00:00:00.000Z'),
    });

    await service.updateRazorpayConfig(
      {
        key_id: 'rzp_test_12345678',
        key_secret: 'super-secret',
        webhook_secret: 'whsec-123',
        environment: 'test',
        active: true,
      },
      { userId: 'admin-1', tenantId: null, roles: ['super_admin'], permissions: [] },
    );

    expect(repo.upsertEncrypted).toHaveBeenCalled();
    const savedEnc = repo.upsertEncrypted.mock.calls[0][0].valueEnc as string;
    expect(savedEnc).not.toContain('super-secret');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'platform.payment_providers.razorpay.updated',
        afterState: expect.not.objectContaining({ key_secret: expect.anything() }),
      }),
    );
  });

  it('requires encryption key before saving', async () => {
    delete process.env.PLATFORM_SECRETS_ENCRYPTION_KEY;
    const { service } = setup();

    await expect(
      service.updateRazorpayConfig(
        {
          key_id: 'rzp_test_12345678',
          key_secret: 'super-secret',
          webhook_secret: 'whsec-123',
          environment: 'test',
          active: true,
        },
        { userId: 'admin-1', tenantId: null, roles: ['super_admin'], permissions: [] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
