import { Module } from '@nestjs/common';

import { FeatureFlagsModule } from '../../common/feature-flags.module';
import { AuditModule } from '../audit/audit.module';
import { CrmController } from './crm.controller';
import { CrmRepository } from './crm.repository';
import { CrmService } from './crm.service';
import { LeadSourcesController } from './lead-sources.controller';
import { PublicInquiriesController } from './public-inquiries.controller';

@Module({
  imports: [AuditModule, FeatureFlagsModule],
  controllers: [CrmController, LeadSourcesController, PublicInquiriesController],
  providers: [CrmService, CrmRepository],
  exports: [CrmService],
})
export class CrmModule {}
