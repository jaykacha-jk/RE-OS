import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';
import { RequestLoggingMiddleware } from './common/observability/request-logging.middleware';
import { ObservabilityModule } from './common/observability/observability.module';

import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { UsersModule } from './modules/users/users.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { PlatformModule } from './modules/platform/platform.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { CrmModule } from './modules/crm/crm.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ChatModule } from './modules/chat/chat.module';
import { BillingModule } from './modules/billing/billing.module';
import { SettingsModule } from './modules/settings/settings.module';
import { PublicAnalyticsModule } from './modules/public-analytics/public-analytics.module';
import { AiModule } from './modules/ai/ai.module';
import { EventsModule } from './events/events.module';
import { JobsModule } from './jobs/jobs.module';
import { PrismaModule } from './common/database/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
      {
        name: 'auth',
        ttl: 60_000,
        limit: 10,
      },
    ]),
    ObservabilityModule,
    PrismaModule,
    EventsModule,
    JobsModule,
    HealthModule,
    PlatformModule,
    AuthModule,
    TenantModule,
    UsersModule,
    RbacModule,
    EmployeesModule,
    PropertiesModule,
    CrmModule,
    AnalyticsModule,
    AuditModule,
    NotificationsModule,
    ChatModule,
    BillingModule,
    SettingsModule,
    PublicAnalyticsModule,
    AiModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestLoggingMiddleware, SecurityHeadersMiddleware)
      .forRoutes('*');
  }
}

