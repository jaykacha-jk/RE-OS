import { Module } from '@nestjs/common';

import { FeatureFlagsModule } from '../../common/feature-flags.module';
import { AuditModule } from '../audit/audit.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { StorageService } from '../properties/storage/storage.service';
import { BillingController, BillingWebhookController } from './billing.controller';
import { BillingRepository } from './billing.repository';
import { BillingService } from './billing.service';
import { QuotaService } from './quota.service';
import { MockProvider } from './providers/mock.provider';
import { PlatformBillingController } from './platform-billing.controller';
import { RazorpayProvider } from './providers/razorpay.provider';

@Module({
  imports: [AuditModule, FeatureFlagsModule, PlatformSettingsModule],
  controllers: [BillingController, BillingWebhookController, PlatformBillingController],
  providers: [BillingService, BillingRepository, QuotaService, MockProvider, RazorpayProvider, StorageService],
  exports: [BillingService, QuotaService],
})
export class BillingModule {}
