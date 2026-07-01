import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../../common/context/auth-user';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { UpdateRazorpayPlatformConfigDto } from './dto/update-razorpay-platform-config.dto';
import { PlatformPaymentConfigService } from './platform-payment-config.service';

function envelope<T>(data: T) {
  return { data, meta: { request_id: randomBytes(16).toString('hex') } };
}

function requestMeta(req: Request) {
  return {
    userAgent: req.headers['user-agent'] as string | undefined,
    ipAddress: req.ip,
  };
}

@ApiTags('Platform Payment Providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/platform/payment-providers')
export class PlatformPaymentController {
  constructor(private readonly paymentConfig: PlatformPaymentConfigService) {}

  @Get('razorpay')
  @RequirePermissions('platform.payment_providers.read')
  @ApiOperation({ summary: 'Get masked Razorpay platform configuration (Super Admin)' })
  async getRazorpay() {
    return envelope(await this.paymentConfig.getMaskedRazorpayConfig());
  }

  @Put('razorpay')
  @RequirePermissions('platform.payment_providers.update')
  @ApiOperation({ summary: 'Update Razorpay platform credentials (encrypted at rest)' })
  async updateRazorpay(
    @Body() dto: UpdateRazorpayPlatformConfigDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return envelope(await this.paymentConfig.updateRazorpayConfig(dto, user, requestMeta(req)));
  }
}
