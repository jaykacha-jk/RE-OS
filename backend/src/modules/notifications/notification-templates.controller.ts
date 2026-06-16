import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { randomBytes } from 'node:crypto';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import type { AuthUser } from '../../common/context/auth-user';
import { FeatureFlagGuard } from '../../common/guards/feature-flag.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { NotificationTemplatesService } from './notification-templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

function requestMeta(req: Request) {
  return {
    userAgent: req.headers['user-agent'] as string | undefined,
    ipAddress: req.ip,
  };
}

function envelope<T>(data: T) {
  return { data, meta: { request_id: randomBytes(16).toString('hex') } };
}

/**
 * Admin-only template management. Org admins manage their tenant's templates;
 * Super Admin manages global/system templates (tenant_id = null). No
 * TenantGuard so Super Admin (tenant_id = null) is permitted.
 */
@ApiTags('Notifications — Templates (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('notifications')
@Controller('api/v1/notification-templates')
export class NotificationTemplatesController {
  constructor(private readonly templates: NotificationTemplatesService) {}

  @Get()
  @RequirePermissions('notifications.templates.manage')
  @ApiOperation({ summary: 'List notification templates + system defaults' })
  @ApiOkResponse({ description: 'Tenant templates plus read-only system defaults' })
  async list(@CurrentUser() user: AuthUser) {
    return envelope(await this.templates.list(user.tenantId));
  }

  @Post()
  @RequirePermissions('notifications.templates.manage')
  @ApiOperation({ summary: 'Create a notification template' })
  @ApiCreatedResponse({ description: 'Template created' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTemplateDto,
    @Req() req: Request,
  ) {
    return envelope(
      await this.templates.create(user.tenantId, user, dto, requestMeta(req)),
    );
  }

  @Patch(':id')
  @RequirePermissions('notifications.templates.manage')
  @ApiOperation({ summary: 'Update a notification template' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @Req() req: Request,
  ) {
    return envelope(
      await this.templates.update(user.tenantId, user, id, dto, requestMeta(req)),
    );
  }
}
