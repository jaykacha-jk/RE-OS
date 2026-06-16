import {
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { NotificationsService } from './notifications.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';

function envelope<T>(data: T) {
  return { data, meta: { request_id: randomBytes(16).toString('hex') } };
}

/**
 * User-facing notification center.
 *
 * NOTE: no TenantGuard — notifications are personal and Super Admins
 * (tenant_id = null) must access their platform notifications too. Isolation is
 * enforced in the service/repository by always scoping to `user_id` + the
 * caller's own `tenant_id`.
 */
@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('notifications')
@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermissions('notifications.read')
  @ApiOperation({ summary: 'List my notifications (paginated, filterable)' })
  @ApiOkResponse({ description: 'Paginated notifications for the current user' })
  async list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListNotificationsQueryDto,
  ) {
    const result = await this.notifications.list(user, query);
    return {
      data: result.data,
      meta: { ...result.meta, request_id: randomBytes(16).toString('hex') },
    };
  }

  @Get('unread-count')
  @RequirePermissions('notifications.read')
  @ApiOperation({ summary: 'Get my unread notification count' })
  async unreadCount(@CurrentUser() user: AuthUser) {
    return envelope(await this.notifications.unreadCount(user));
  }

  @Patch(':id/read')
  @HttpCode(200)
  @RequirePermissions('notifications.read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return envelope(await this.notifications.markRead(user, id));
  }

  @Patch('read-all')
  @HttpCode(200)
  @RequirePermissions('notifications.read')
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  async markAllRead(@CurrentUser() user: AuthUser) {
    return envelope(await this.notifications.markAllRead(user));
  }
}
