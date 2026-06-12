import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PublicAnalyticsQueryDto } from './dto/public-analytics-query.dto';
import { PublicAnalyticsService } from './public-analytics.service';

@ApiTags('Public Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('api/v1/analytics/public')
export class PublicAnalyticsController {
  constructor(private readonly analytics: PublicAnalyticsService) {}

  @Get()
  @RequirePermissions('analytics.public.read')
  @ApiOperation({ summary: 'Public website analytics (views, clicks, conversions, traffic)' })
  @ApiOkResponse({ description: 'Public analytics dashboard' })
  async get(@TenantId() tenantId: string, @Query() query: PublicAnalyticsQueryDto) {
    const data = await this.analytics.getPublicDashboard(tenantId, query);
    return { data, meta: { request_id: randomBytes(16).toString('hex') } };
  }
}
