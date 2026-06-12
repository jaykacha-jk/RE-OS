import { Body, Controller, Get, Headers, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import type { AuthUser } from '../../common/context/auth-user';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { BillingService } from './billing.service';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { ChangePlanDto } from './dto/change-plan.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { RazorpayWebhookDto } from './dto/razorpay-webhook.dto';
import { SubscribeDto } from './dto/subscribe.dto';

type RawBodyRequest = Request & { rawBody?: Buffer };

function envelope<T>(data: T) {
  return { data, meta: { request_id: randomBytes(16).toString('hex') } };
}

function requestMeta(req: Request) {
  return {
    userAgent: req.headers['user-agent'] as string | undefined,
    ipAddress: req.ip,
  };
}

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('api/v1/billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  @RequirePermissions('billing.plans.read')
  @ApiOperation({ summary: 'List active subscription plans' })
  async plans() {
    return envelope(await this.billing.listPlans());
  }

  @Get('subscription')
  @RequirePermissions('billing.subscription.read')
  @ApiOperation({ summary: 'Get current tenant subscription' })
  async subscription(@TenantId() tenantId: string) {
    return envelope(await this.billing.getSubscription(tenantId));
  }

  @Post('subscribe')
  @RequirePermissions('billing.subscription.update')
  @ApiOperation({ summary: 'Create subscription checkout for a plan' })
  async subscribe(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SubscribeDto,
    @Req() req: Request,
  ) {
    return envelope(await this.billing.subscribe(tenantId, dto, user, requestMeta(req)));
  }

  @Post('change-plan')
  @RequirePermissions('billing.subscription.update')
  @ApiOperation({ summary: 'Change current subscription plan' })
  async changePlan(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePlanDto,
    @Req() req: Request,
  ) {
    return envelope(await this.billing.changePlan(tenantId, dto, user, requestMeta(req)));
  }

  @Post('cancel')
  @RequirePermissions('billing.subscription.update')
  @ApiOperation({ summary: 'Cancel current subscription' })
  async cancel(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CancelSubscriptionDto,
    @Req() req: Request,
  ) {
    return envelope(await this.billing.cancel(tenantId, dto, user, requestMeta(req)));
  }

  @Get('invoices')
  @RequirePermissions('billing.invoices.read')
  @ApiOperation({ summary: 'List tenant invoices' })
  async invoices(@TenantId() tenantId: string, @Query() query: ListInvoicesQueryDto) {
    return envelope(await this.billing.listInvoices(tenantId, query));
  }

  @Get('usage')
  @RequirePermissions('billing.usage.read')
  @ApiOperation({ summary: 'Get usage against active plan limits' })
  async usage(@TenantId() tenantId: string) {
    return envelope(await this.billing.getUsage(tenantId));
  }
}

@ApiTags('Billing Webhooks')
@Controller('api/v1/billing/webhooks')
export class BillingWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Post('razorpay')
  @ApiOperation({ summary: 'Process Razorpay webhook with HMAC signature validation' })
  async razorpay(
    @Body() dto: RazorpayWebhookDto,
    @Headers('x-razorpay-signature') signature?: string,
    @Req() req?: RawBodyRequest,
  ) {
    return envelope(await this.billing.processRazorpayWebhook(dto, signature, req?.rawBody));
  }
}
