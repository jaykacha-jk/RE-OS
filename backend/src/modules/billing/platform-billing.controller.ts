import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../../common/context/auth-user';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BillingService } from './billing.service';
import { CreatePlatformPlanDto } from './dto/create-platform-plan.dto';
import { UpdatePlatformPlanDto } from './dto/update-platform-plan.dto';

function envelope<T>(data: T) {
  return { data, meta: { request_id: randomBytes(16).toString('hex') } };
}

function requestMeta(req: Request) {
  return {
    userAgent: req.headers['user-agent'] as string | undefined,
    ipAddress: req.ip,
  };
}

@ApiTags('Platform Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/platform')
export class PlatformBillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('billing/metrics')
  @RequirePermissions('platform.billing.read')
  @ApiOperation({ summary: 'Platform revenue, MRR, churn, and subscription health' })
  async metrics() {
    return envelope(await this.billing.platformMetrics());
  }

  @Get('plans')
  @RequirePermissions('platform.plans.read')
  @ApiOperation({ summary: 'List all subscription plans (Super Admin)' })
  @ApiOkResponse({ description: 'All plans including inactive' })
  async listPlans() {
    return envelope(await this.billing.listPlatformPlans());
  }

  @Get('plans/:id')
  @RequirePermissions('platform.plans.read')
  @ApiOperation({ summary: 'Get subscription plan by id' })
  async getPlan(@Param('id') id: string) {
    return envelope(await this.billing.getPlatformPlan(id));
  }

  @Post('plans')
  @RequirePermissions('platform.plans.create')
  @ApiOperation({ summary: 'Create subscription plan' })
  @ApiCreatedResponse({ description: 'Plan created' })
  async createPlan(
    @Body() dto: CreatePlatformPlanDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return envelope(await this.billing.createPlatformPlan(dto, user, requestMeta(req)));
  }

  @Patch('plans/:id')
  @RequirePermissions('platform.plans.update')
  @ApiOperation({ summary: 'Update subscription plan' })
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdatePlatformPlanDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return envelope(await this.billing.updatePlatformPlan(id, dto, user, requestMeta(req)));
  }
}
