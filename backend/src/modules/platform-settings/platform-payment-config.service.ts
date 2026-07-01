import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { SecretCipherService } from '../../common/security/secret-cipher.service';
import type { AuthUser } from '../../common/context/auth-user';
import { AuditService, type AuditRequestMeta } from '../audit/audit.service';
import { UpdateRazorpayPlatformConfigDto } from './dto/update-razorpay-platform-config.dto';
import {
  PLATFORM_SETTINGS_KEYS,
  type RazorpayCredentials,
  type RazorpayPlatformConfig,
  type RazorpayPlatformConfigMasked,
} from './platform-settings.constants';
import { PlatformSettingsRepository } from './platform-settings.repository';

const CACHE_TTL_MS = 5 * 60_000;

function maskKeyId(keyId: string): string {
  if (keyId.length <= 8) return '****';
  return `${keyId.slice(0, 8)}****${keyId.slice(-4)}`;
}

@Injectable()
export class PlatformPaymentConfigService {
  private readonly logger = new Logger(PlatformPaymentConfigService.name);
  private credentialsCache: { expiresAt: number; value: RazorpayCredentials | null } | null = null;

  constructor(
    private readonly repo: PlatformSettingsRepository,
    private readonly cipher: SecretCipherService,
    private readonly audit: AuditService,
  ) {}

  invalidateCache() {
    this.credentialsCache = null;
  }

  async getMaskedRazorpayConfig(): Promise<RazorpayPlatformConfigMasked> {
    const row = await this.repo.findByKey(PLATFORM_SETTINGS_KEYS.RAZORPAY);
    if (row) {
      try {
        const config = this.decryptConfig(row.value_enc);
        return {
          provider: 'razorpay',
          environment: config.environment,
          active: config.active,
          key_id_masked: config.key_id ? maskKeyId(config.key_id) : null,
          key_secret_configured: Boolean(config.key_secret),
          webhook_secret_configured: Boolean(config.webhook_secret),
          source: 'database',
          version: row.version,
          updated_at: row.updated_at.toISOString(),
        };
      } catch (error) {
        this.logger.error(
          `Failed to decrypt Razorpay platform config: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const env = this.readEnvCredentials();
    if (env) {
      return {
        provider: 'razorpay',
        environment: env.keyId.includes('_live_') ? 'live' : 'test',
        active: true,
        key_id_masked: maskKeyId(env.keyId),
        key_secret_configured: Boolean(env.keySecret),
        webhook_secret_configured: Boolean(env.webhookSecret),
        source: 'environment',
        version: null,
        updated_at: null,
      };
    }

    return {
      provider: 'razorpay',
      environment: 'test',
      active: false,
      key_id_masked: null,
      key_secret_configured: false,
      webhook_secret_configured: false,
      source: 'none',
      version: null,
      updated_at: null,
    };
  }

  async getActiveRazorpayCredentials(): Promise<RazorpayCredentials | null> {
    if (this.credentialsCache && this.credentialsCache.expiresAt > Date.now()) {
      return this.credentialsCache.value;
    }

    const row = await this.repo.findByKey(PLATFORM_SETTINGS_KEYS.RAZORPAY);
    if (row) {
      try {
        const config = this.decryptConfig(row.value_enc);
        if (config.active && config.key_id && config.key_secret) {
          const value: RazorpayCredentials = {
            keyId: config.key_id,
            keySecret: config.key_secret,
            webhookSecret: config.webhook_secret,
            environment: config.environment,
            source: 'database',
          };
          this.credentialsCache = { expiresAt: Date.now() + CACHE_TTL_MS, value };
          return value;
        }
      } catch (error) {
        this.logger.error(
          `Razorpay credential load failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const env = this.readEnvCredentials();
    if (env) {
      const value: RazorpayCredentials = {
        ...env,
        environment: env.keyId.includes('_live_') ? 'live' : 'test',
        source: 'environment',
      };
      this.credentialsCache = { expiresAt: Date.now() + CACHE_TTL_MS, value };
      return value;
    }

    this.credentialsCache = { expiresAt: Date.now() + CACHE_TTL_MS, value: null };
    return null;
  }

  async updateRazorpayConfig(
    dto: UpdateRazorpayPlatformConfigDto,
    actor: AuthUser,
    meta?: AuditRequestMeta,
  ): Promise<RazorpayPlatformConfigMasked> {
    if (!this.cipher.isConfigured()) {
      throw new BadRequestException(
        'PLATFORM_SECRETS_ENCRYPTION_KEY must be configured before saving payment credentials',
      );
    }

    const existing = await this.repo.findByKey(PLATFORM_SETTINGS_KEYS.RAZORPAY);
    const current = existing ? this.decryptConfig(existing.value_enc) : null;

    const next: RazorpayPlatformConfig = {
      key_id: dto.key_id?.trim() || current?.key_id || '',
      key_secret: dto.key_secret?.trim() || current?.key_secret || '',
      webhook_secret: dto.webhook_secret?.trim() || current?.webhook_secret || '',
      environment: dto.environment,
      active: dto.active,
    };

    if (next.active) {
      if (!next.key_id || !next.key_secret) {
        throw new BadRequestException('Razorpay Key ID and Secret are required when active');
      }
      if (!next.webhook_secret) {
        throw new BadRequestException('Razorpay Webhook Secret is required when active');
      }
    }

    const valueEnc = this.cipher.encrypt(JSON.stringify(next));
    const version = (existing?.version ?? 0) + 1;

    await this.repo.upsertEncrypted({
      key: PLATFORM_SETTINGS_KEYS.RAZORPAY,
      valueEnc,
      version,
      previousValueEnc: existing?.value_enc ?? null,
      updatedBy: actor.userId,
    });

    this.invalidateCache();

    await this.audit.record({
      actor,
      tenantId: null,
      action: 'platform.payment_providers.razorpay.updated',
      entityType: 'platform_settings',
      entityId: PLATFORM_SETTINGS_KEYS.RAZORPAY,
      afterState: {
        environment: next.environment,
        active: next.active,
        key_id_masked: next.key_id ? maskKeyId(next.key_id) : null,
        version,
      },
      meta,
    });

    return this.getMaskedRazorpayConfig();
  }

  private decryptConfig(valueEnc: string): RazorpayPlatformConfig {
    return JSON.parse(this.cipher.decrypt(valueEnc)) as RazorpayPlatformConfig;
  }

  private readEnvCredentials(): Omit<RazorpayCredentials, 'environment' | 'source'> | null {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!keyId || !keySecret) return null;
    return {
      keyId,
      keySecret,
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? '',
    };
  }
}
