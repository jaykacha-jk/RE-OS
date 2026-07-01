import {
  Body,
  Controller,
  Get,
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
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import type { AuthUser } from '../../common/context/auth-user';
import { FeatureFlagGuard } from '../../common/guards/feature-flag.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CrmService } from './crm.service';
import { CreateLeadSourceDto, UpdateLeadSourceDto } from './dto/lead-source.dto';

function requestMeta(req: Request) {
  return {
    userAgent: req.headers['user-agent'] as string | undefined,
    ipAddress: req.ip,
  };
}

function envelope<T>(data: T, extraMeta?: Record<string, unknown>) {
  return { data, meta: { request_id: randomBytes(16).toString('hex'), ...extraMeta } };
}

@ApiTags('CRM — Lead Sources')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('crm')
@Controller('api/v1/lead-sources')
export class LeadSourcesController {
  constructor(private readonly crm: CrmService) {}

  @Get()
  @RequirePermissions('crm.lead_sources.read')
  @ApiOperation({ summary: 'List tenant lead sources' })
  @ApiOkResponse({ description: 'Lead source list' })
  async list(
    @TenantId() tenantId: string,
    @Query('include_inactive') includeInactive?: string,
    @Query() pagination?: PaginationQueryDto,
  ) {
    const result = await this.crm.listLeadSources(
      tenantId,
      includeInactive === 'true',
      pagination?.page,
      pagination?.per_page,
    );
    return envelope(result.data, result.pagination);
  }

  @Post()
  @RequirePermissions('crm.lead_sources.manage')
  @ApiOperation({ summary: 'Create a lead source' })
  @ApiCreatedResponse({ description: 'Lead source created' })
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateLeadSourceDto,
    @Req() req: Request,
  ) {
    return envelope(await this.crm.createLeadSource(tenantId, user, dto, requestMeta(req)));
  }

  @Patch(':id')
  @RequirePermissions('crm.lead_sources.manage')
  @ApiOperation({ summary: 'Update a lead source (rename / activate / deactivate)' })
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeadSourceDto,
    @Req() req: Request,
  ) {
    return envelope(await this.crm.updateLeadSource(tenantId, user, id, dto, requestMeta(req)));
  }
}
