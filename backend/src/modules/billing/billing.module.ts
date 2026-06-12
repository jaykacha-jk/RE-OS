import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { BillingController, BillingWebhookController } from './billing.controller';
import { BillingRepository } from './billing.repository';
import { BillingService } from './billing.service';
import { MockProvider } from './providers/mock.provider';
import { PlatformBillingController } from './platform-billing.controller';
import { RazorpayProvider } from './providers/razorpay.provider';

@Module({
  imports: [AuditModule],
  controllers: [BillingController, BillingWebhookController, PlatformBillingController],
  providers: [BillingService, BillingRepository, MockProvider, RazorpayProvider],
  exports: [BillingService],
})
export class BillingModule {}
