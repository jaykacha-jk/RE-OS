import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../../common/context/auth-user';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { EndImpersonationDto } from './dto/end-impersonation.dto';
import { PlatformService } from './platform.service';

@ApiTags('Platform')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/platform/impersonation')
export class PlatformImpersonationController {
  constructor(private readonly platformService: PlatformService) {}

  @Post('end')
  @HttpCode(200)
  @RequirePermissions('platform.impersonate')
  @ApiOperation({ summary: 'End audited tenant impersonation session' })
  @ApiOkResponse({ description: 'Impersonation ended' })
  async end(
    @Body() dto: EndImpersonationDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.platformService.endImpersonation(dto.tenant_id, user, {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: req.ip,
    });
    return {
      data,
      meta: { request_id: randomBytes(16).toString('hex') },
    };
  }
}
