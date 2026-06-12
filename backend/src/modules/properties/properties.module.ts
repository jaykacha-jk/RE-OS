import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PropertiesController } from './properties.controller';
import { PropertiesRepository } from './properties.repository';
import { PropertiesService } from './properties.service';
import { PublicPropertiesController } from './public-properties.controller';
import { StorageService } from './storage/storage.service';

@Module({
  imports: [AuditModule],
  controllers: [PropertiesController, PublicPropertiesController],
  providers: [PropertiesService, PropertiesRepository, StorageService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
