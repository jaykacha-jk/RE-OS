import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuditModule } from '../audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

@Module({
  imports: [AuditModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, JwtAuthGuard],
})
export class AuthModule {}

