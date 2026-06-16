import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import type { AuthUser } from '../../common/context/auth-user';
import { FeatureFlagGuard } from '../../common/guards/feature-flag.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

function envelope<T>(data: T) {
  return { data, meta: { request_id: randomBytes(16).toString('hex') } };
}

/**
 * Tenant analytics (Organization + Employee dashboards).
 *
 * RBAC: every route requires `analytics.read`. The *visibility scope* is resolved
 * in the service from the caller's roles — org-wide (owner/admin), team
 * (manager), or assigned-only (sales executive / telecaller). Clients have no
 * `analytics.read` permission and receive 403. Super Admin platform metrics live
 * under `/api/v1/platform/analytics/*` (no tenant context).
 */
@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('analytics')
@Controller('api/v1/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('dashboard')
  @RequirePermissions('analytics.read')
  @ApiOperation({ summary: 'Unified dashboard aggregation (RBAC-scoped, single round trip)' })
  @ApiOkResponse({ description: 'Dashboard KPIs, charts and trends' })
  async dashboard(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    return envelope(await this.analytics.getDashboard(tenantId, user, query));
  }

  @Get('leads')
  @RequirePermissions('analytics.read')
  @ApiOperation({ summary: 'Lead KPIs + monthly leads trend' })
  async leads(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    return envelope(await this.analytics.getLeads(tenantId, user, query));
  }

  @Get('properties')
  @RequirePermissions('analytics.read')
  @ApiOperation({ summary: 'Property inventory KPIs (status snapshot)' })
  async properties(@TenantId() tenantId: string, @CurrentUser() user: AuthUser) {
    return envelope(await this.analytics.getProperties(tenantId, user));
  }

  @Get('employees')
  @RequirePermissions('analytics.read')
  @ApiOperation({ summary: 'Employee performance table (org/team scope only)' })
  async employees(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    return envelope(await this.analytics.getEmployees(tenantId, user, query));
  }

  @Get('funnel')
  @RequirePermissions('analytics.read')
  @ApiOperation({ summary: 'Lead funnel (New → Won)' })
  async funnel(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    return envelope(await this.analytics.getFunnel(tenantId, user, query));
  }

  @Get('sources')
  @RequirePermissions('analytics.read')
  @ApiOperation({ summary: 'Lead source breakdown' })
  async sources(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    return envelope(await this.analytics.getSources(tenantId, user, query));
  }

  @Get('conversions')
  @RequirePermissions('analytics.read')
  @ApiOperation({ summary: 'Conversion rate + monthly conversion trend' })
  async conversions(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    return envelope(await this.analytics.getConversions(tenantId, user, query));
  }

  @Get('revenue')
  @RequirePermissions('analytics.read')
  @ApiOperation({ summary: 'Revenue from won deals (range by close date)' })
  async revenue(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    return envelope(await this.analytics.getRevenue(tenantId, user, query));
  }
}
