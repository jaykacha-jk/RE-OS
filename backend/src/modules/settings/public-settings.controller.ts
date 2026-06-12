import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';

import { SettingsService } from './settings.service';

/**
 * Public, unauthenticated settings used to render a tenant's website / login
 * page. Tenant is resolved from the `tenant` slug. Only the public-facing
 * presentation layer (branding, website content, SEO, white-label) is exposed —
 * never feature flags, configuration, or internal fields.
 */
@ApiTags('Public Settings')
@Controller('api/v1/public/settings')
export class PublicSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Public branding/website/SEO/white-label for a tenant site' })
  @ApiOkResponse({ description: 'Public presentation settings' })
  async get(@Query('tenant') tenant?: string) {
    if (!tenant) throw new BadRequestException('tenant slug is required');
    const data = await this.settings.getPublicSettings(tenant);
    return { data, meta: { request_id: randomBytes(16).toString('hex') } };
  }
}
