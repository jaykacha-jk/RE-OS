import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BillingService } from './billing.service';

function envelope<T>(data: T) {
  return { data, meta: { request_id: randomBytes(16).toString('hex') } };
}

@ApiTags('Platform Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/platform/billing')
export class PlatformBillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('metrics')
  @RequirePermissions('platform.billing.read')
  @ApiOperation({ summary: 'Platform revenue, MRR, churn, and subscription health' })
  async metrics() {
    return envelope(await this.billing.platformMetrics());
  }
}
