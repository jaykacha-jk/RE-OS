import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { randomBytes } from 'node:crypto';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import type { AuthUser } from '../../common/context/auth-user';
import { FeatureFlagGuard } from '../../common/guards/feature-flag.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { NotificationPreferencesService } from './notification-preferences.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

function envelope<T>(data: T) {
  return { data, meta: { request_id: randomBytes(16).toString('hex') } };
}

@ApiTags('Notifications — Preferences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('notifications')
@Controller('api/v1/notification-preferences')
export class NotificationPreferencesController {
  constructor(private readonly preferences: NotificationPreferencesService) {}

  @Get()
  @RequirePermissions('notifications.read')
  @ApiOperation({ summary: 'Get my notification channel preferences' })
  @ApiOkResponse({ description: 'Per-event in-app / email preferences' })
  async list(@CurrentUser() user: AuthUser) {
    return envelope(await this.preferences.list(user.userId));
  }

  @Patch()
  @RequirePermissions('notifications.preferences.update')
  @ApiOperation({ summary: 'Update my notification channel preferences' })
  async update(@CurrentUser() user: AuthUser, @Body() dto: UpdatePreferencesDto) {
    return envelope(
      await this.preferences.update(user.userId, user.tenantId, dto),
    );
  }
}
