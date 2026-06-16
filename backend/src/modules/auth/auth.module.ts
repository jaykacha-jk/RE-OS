import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JobsModule } from '../../jobs/jobs.module';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

@Module({
  imports: [AuditModule, JobsModule, SettingsModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, JwtAuthGuard],
})
export class AuthModule {}

