import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import type { AuthUser } from '../../common/context/auth-user';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { UpdateConfigurationDto } from './dto/update-configuration.dto';
import { UpdateFeaturesDto } from './dto/update-features.dto';
import { UpdateSeoDto } from './dto/update-seo.dto';
import { UpdateWebsiteDto } from './dto/update-website.dto';
import { UpdateWhiteLabelDto } from './dto/update-white-label.dto';
import { FeatureFlagsService } from './feature-flags.service';
import { SettingsService } from './settings.service';
import { TenantConfigService } from './tenant-config.service';

function requestMeta(req: Request) {
  return { userAgent: req.headers['user-agent'] as string | undefined, ipAddress: req.ip };
}

function envelope<T>(data: T) {
  return { data, meta: { request_id: randomBytes(16).toString('hex') } };
}

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('api/v1/settings')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly features: FeatureFlagsService,
    private readonly config: TenantConfigService,
  ) {}

  @Get()
  @RequirePermissions('settings.read')
  @ApiOperation({ summary: 'Get all tenant settings (every category, merged with defaults)' })
  @ApiOkResponse({ description: 'All settings categories' })
  async getAll(@TenantId() tenantId: string) {
    return envelope(await this.settings.getAll(tenantId));
  }

  // --- Branding --------------------------------------------------------------

  @Get('branding')
  @RequirePermissions('settings.read')
  @ApiOperation({ summary: 'Get branding settings' })
  async getBranding(@TenantId() tenantId: string) {
    return envelope(await this.settings.getCategory(tenantId, 'branding'));
  }

  @Patch('branding')
  @RequirePermissions('settings.branding.manage')
  @ApiOperation({ summary: 'Update branding settings (logo, colors, typography, email/PDF branding)' })
  async updateBranding(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBrandingDto,
    @Req() req: Request,
  ) {
    return envelope(
      await this.settings.updateCategory(tenantId, 'branding', dto as Record<string, unknown>, user, requestMeta(req)),
    );
  }

  // --- SEO -------------------------------------------------------------------

  @Get('seo')
  @RequirePermissions('settings.read')
  @ApiOperation({ summary: 'Get SEO settings' })
  async getSeo(@TenantId() tenantId: string) {
    return envelope(await this.settings.getCategory(tenantId, 'seo'));
  }

  @Patch('seo')
  @RequirePermissions('settings.seo.manage')
  @ApiOperation({ summary: 'Update SEO settings (meta, OG, Twitter, schema, robots, sitemap)' })
  async updateSeo(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateSeoDto,
    @Req() req: Request,
  ) {
    return envelope(
      await this.settings.updateCategory(tenantId, 'seo', dto as Record<string, unknown>, user, requestMeta(req)),
    );
  }

  // --- Website ---------------------------------------------------------------

  @Get('website')
  @RequirePermissions('settings.read')
  @ApiOperation({ summary: 'Get website content settings' })
  async getWebsite(@TenantId() tenantId: string) {
    return envelope(await this.settings.getCategory(tenantId, 'website'));
  }

  @Patch('website')
  @RequirePermissions('settings.website.manage')
  @ApiOperation({ summary: 'Update website content (hero, contact, social, testimonials, footer)' })
  async updateWebsite(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateWebsiteDto,
    @Req() req: Request,
  ) {
    return envelope(
      await this.settings.updateCategory(tenantId, 'website', dto as Record<string, unknown>, user, requestMeta(req)),
    );
  }

  // --- Feature flags ---------------------------------------------------------

  @Get('features')
  @RequirePermissions('settings.read')
  @ApiOperation({ summary: 'Get resolved feature flags' })
  async getFeatures(@TenantId() tenantId: string) {
    return envelope(await this.features.getFlags(tenantId));
  }

  @Patch('features')
  @RequirePermissions('settings.features.manage')
  @ApiOperation({ summary: 'Toggle feature flags (Owner only)' })
  async updateFeatures(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateFeaturesDto,
    @Req() req: Request,
  ) {
    await this.settings.updateCategory(tenantId, 'features', dto as Record<string, unknown>, user, requestMeta(req));
    return envelope(await this.features.getFlags(tenantId));
  }

  // --- Configuration ---------------------------------------------------------

  @Get('configuration')
  @RequirePermissions('settings.read')
  @ApiOperation({ summary: 'Get tenant configuration (timezone, currency, locale, business hours)' })
  async getConfiguration(@TenantId() tenantId: string) {
    return envelope(await this.config.getConfiguration(tenantId));
  }

  @Patch('configuration')
  @RequirePermissions('settings.configuration.manage')
  @ApiOperation({ summary: 'Update tenant configuration' })
  async updateConfiguration(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateConfigurationDto,
    @Req() req: Request,
  ) {
    await this.settings.updateCategory(
      tenantId,
      'configuration',
      dto as Record<string, unknown>,
      user,
      requestMeta(req),
    );
    return envelope(await this.config.getConfiguration(tenantId));
  }

  // --- White label -----------------------------------------------------------

  @Get('white-label')
  @RequirePermissions('settings.read')
  @ApiOperation({ summary: 'Get white-label settings' })
  async getWhiteLabel(@TenantId() tenantId: string) {
    return envelope(await this.settings.getCategory(tenantId, 'white_label'));
  }

  @Patch('white-label')
  @RequirePermissions('settings.whitelabel.manage')
  @ApiOperation({ summary: 'Update white-label settings (Owner only)' })
  async updateWhiteLabel(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateWhiteLabelDto,
    @Req() req: Request,
  ) {
    return envelope(
      await this.settings.updateCategory(
        tenantId,
        'white_label',
        dto as Record<string, unknown>,
        user,
        requestMeta(req),
      ),
    );
  }
}
