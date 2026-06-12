import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { randomBytes } from 'crypto';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthUser } from '../../common/context/auth-user';
import { AuthService } from './auth.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login with email/password' })
  @ApiOkResponse({ description: 'Access + refresh tokens' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const result = await this.authService.login(dto, {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: req.ip,
    });

    return {
      data: result,
      meta: { request_id: randomBytes(16).toString('hex') },
    };
  }

  @Post('refresh')
  @Throttle({ auth: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh access token (rotates refresh token)' })
  async refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    const result = await this.authService.refresh(dto, {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: req.ip,
    });

    return {
      data: result,
      meta: { request_id: randomBytes(16).toString('hex') },
    };
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Logout (revoke refresh token)' })
  async logout(@Body() dto: RefreshDto, @Req() req: Request) {
    await this.authService.logout(dto, {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: req.ip,
    });
  }

  @Post('accept-invitation')
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Accept invitation and set password' })
  async acceptInvitation(@Body() dto: AcceptInvitationDto, @Req() req: Request) {
    const result = await this.authService.acceptInvitation(dto, {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: req.ip,
    });
    return {
      data: result,
      meta: { request_id: randomBytes(16).toString('hex') },
    };
  }

  @Post('forgot-password')
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Request password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const data = await this.authService.forgotPassword(dto, {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: req.ip,
    });
    return {
      data,
      meta: { request_id: randomBytes(16).toString('hex') },
    };
  }

  @Post('reset-password')
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const data = await this.authService.resetPassword(dto, {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: req.ip,
    });
    return {
      data,
      meta: { request_id: randomBytes(16).toString('hex') },
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user + roles/permissions' })
  async me(@CurrentUser() user: AuthUser) {
    const data = await this.authService.me(user);
    return { data, meta: { request_id: randomBytes(16).toString('hex') } };
  }
}

