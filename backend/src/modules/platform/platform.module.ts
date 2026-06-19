import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { StorageService } from '../properties/storage/storage.service';
import { PlatformController } from './platform.controller';
import { PlatformImpersonationController } from './platform-impersonation.controller';
import { PlatformRepository } from './platform.repository';
import { PlatformService } from './platform.service';

@Module({
  imports: [AuditModule, BillingModule],
  controllers: [PlatformController, PlatformImpersonationController],
  providers: [PlatformService, PlatformRepository, StorageService],
  exports: [PlatformService],
})
export class PlatformModule {}
