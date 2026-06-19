import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
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
import { randomBytes } from 'crypto';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../../common/context/auth-user';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { ListOrganizationsQueryDto } from './dto/list-organizations-query.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UploadOrgLogoDto } from './dto/upload-org-logo.dto';
import { EndImpersonationDto } from './dto/end-impersonation.dto';
import { PlatformService } from './platform.service';

@ApiTags('Platform')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/platform/organizations')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get()
  @RequirePermissions('platform.organizations.read')
  @ApiOperation({ summary: 'List organizations (Super Admin)' })
  @ApiOkResponse({ description: 'Paginated organization list' })
  async list(@Query() query: ListOrganizationsQueryDto) {
    const result = await this.platformService.listOrganizations(query);
    return {
      data: result.data,
      meta: { ...result.meta, request_id: randomBytes(16).toString('hex') },
    };
  }

  @Get(':id')
  @RequirePermissions('platform.organizations.read')
  @ApiOperation({ summary: 'Get organization by id (Super Admin)' })
  @ApiOkResponse({ description: 'Organization detail' })
  async getOne(@Param('id') id: string) {
    const data = await this.platformService.getOrganization(id);
    return {
      data,
      meta: { request_id: randomBytes(16).toString('hex') },
    };
  }

  @Post()
  @RequirePermissions('platform.organizations.create')
  @ApiOperation({ summary: 'Create organization and invite owner' })
  @ApiCreatedResponse({ description: 'Organization created' })
  async create(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.platformService.createOrganization(dto, user, {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: req.ip,
    });
    return {
      data,
      meta: { request_id: randomBytes(16).toString('hex') },
    };
  }

  @Patch(':id')
  @RequirePermissions('platform.organizations.update')
  @ApiOperation({ summary: 'Update organization' })
  @ApiOkResponse({ description: 'Organization updated' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.platformService.updateOrganization(id, dto, user, {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: req.ip,
    });
    return {
      data,
      meta: { request_id: randomBytes(16).toString('hex') },
    };
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermissions('platform.organizations.delete')
  @ApiOperation({ summary: 'Soft-delete organization (sets status cancelled)' })
  @ApiOkResponse({ description: 'Organization deleted' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.platformService.deleteOrganization(id, user, {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: req.ip,
    });
    return {
      data,
      meta: { request_id: randomBytes(16).toString('hex') },
    };
  }

  @Post(':id/impersonate')
  @RequirePermissions('platform.impersonate')
  @ApiOperation({ summary: 'Start audited tenant impersonation session (Super Admin)' })
  @ApiOkResponse({ description: 'Impersonation context for client' })
  async impersonate(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.platformService.startImpersonation(id, user, {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: req.ip,
    });
    return {
      data,
      meta: { request_id: randomBytes(16).toString('hex') },
    };
  }

  @Post(':id/logo')
  @RequirePermissions('platform.organizations.update')
  @ApiOperation({ summary: 'Upload organization logo' })
  @ApiOkResponse({ description: 'Organization logo updated' })
  async uploadLogo(
    @Param('id') id: string,
    @Body() dto: UploadOrgLogoDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const data = await this.platformService.uploadOrganizationLogo(id, dto, user, {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: req.ip,
    });
    return {
      data,
      meta: { request_id: randomBytes(16).toString('hex') },
    };
  }
}
