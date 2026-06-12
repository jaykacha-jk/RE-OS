import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

function envelope<T>(data: T) {
  return { data, meta: { request_id: randomBytes(16).toString('hex') } };
}

/**
 * Super Admin platform-wide analytics. No `TenantGuard` — the super admin has no
 * tenant context. Guarded by `platform.analytics.read` (super_admin only).
 */
@ApiTags('Platform Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/platform/analytics')
export class PlatformAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('dashboard')
  @RequirePermissions('platform.analytics.read')
  @ApiOperation({ summary: 'Platform-wide KPIs (orgs, users, revenue/MRR, growth)' })
  @ApiOkResponse({ description: 'Super Admin dashboard metrics' })
  async dashboard(@Query() query: AnalyticsQueryDto) {
    return envelope(await this.analytics.getPlatformDashboard(query));
  }
}
