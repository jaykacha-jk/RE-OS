import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import type { AuthUser } from '../../common/context/auth-user';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { DomainsService } from './domains.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { UpdateDomainDto } from './dto/update-domain.dto';

function requestMeta(req: Request) {
  return { userAgent: req.headers['user-agent'] as string | undefined, ipAddress: req.ip };
}

function envelope<T>(data: T) {
  return { data, meta: { request_id: randomBytes(16).toString('hex') } };
}

@ApiTags('Settings · Domains')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('api/v1/settings/domains')
export class DomainsController {
  constructor(private readonly domains: DomainsService) {}

  @Get()
  @RequirePermissions('settings.read')
  @ApiOperation({ summary: 'List custom domains' })
  @ApiOkResponse({ description: 'Custom domain list' })
  async list(@TenantId() tenantId: string) {
    return envelope(await this.domains.list(tenantId));
  }

  @Post()
  @RequirePermissions('settings.domains.manage')
  @ApiOperation({ summary: 'Add a custom domain (returns DNS records + verification token)' })
  @ApiCreatedResponse({ description: 'Custom domain created' })
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDomainDto,
    @Req() req: Request,
  ) {
    return envelope(await this.domains.create(tenantId, dto, user, requestMeta(req)));
  }

  @Get(':id')
  @RequirePermissions('settings.read')
  @ApiOperation({ summary: 'Get a custom domain' })
  async getOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return envelope(await this.domains.getOne(tenantId, id));
  }

  @Patch(':id')
  @RequirePermissions('settings.domains.manage')
  @ApiOperation({ summary: 'Update a custom domain (primary flag / SSL status)' })
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateDomainDto,
    @Req() req: Request,
  ) {
    return envelope(await this.domains.update(tenantId, id, dto, user, requestMeta(req)));
  }

  @Post(':id/verify')
  @RequirePermissions('settings.domains.manage')
  @ApiOperation({ summary: 'Verify domain ownership via DNS TXT record' })
  async verify(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return envelope(await this.domains.verify(tenantId, id, user, requestMeta(req)));
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermissions('settings.domains.manage')
  @ApiOperation({ summary: 'Remove a custom domain' })
  async remove(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return envelope(await this.domains.remove(tenantId, id, user, requestMeta(req)));
  }
}
