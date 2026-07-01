import { Module } from '@nestjs/common';

import { SecretCipherService } from '../../common/security/secret-cipher.service';
import { AuditModule } from '../audit/audit.module';
import { PlatformPaymentController } from './platform-payment.controller';
import { PlatformPaymentConfigService } from './platform-payment-config.service';
import { PlatformSettingsRepository } from './platform-settings.repository';

@Module({
  imports: [AuditModule],
  controllers: [PlatformPaymentController],
  providers: [
    PlatformSettingsRepository,
    PlatformPaymentConfigService,
    SecretCipherService,
  ],
  exports: [PlatformPaymentConfigService],
})
export class PlatformSettingsModule {}
