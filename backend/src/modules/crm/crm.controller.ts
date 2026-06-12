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
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import type { AuthUser } from '../../common/context/auth-user';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CrmService } from './crm.service';
import { AssignInquiryDto } from './dto/assign-inquiry.dto';
import { ChangeStageDto } from './dto/change-stage.dto';
import { CreateFollowupDto } from './dto/create-followup.dto';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { CreateSiteVisitDto } from './dto/create-site-visit.dto';
import { ListInquiriesQueryDto } from './dto/list-inquiries-query.dto';
import { UpdateFollowupDto } from './dto/update-followup.dto';
import { UpdateInquiryDto } from './dto/update-inquiry.dto';
import { UpdateSiteVisitDto } from './dto/update-site-visit.dto';

function requestMeta(req: Request) {
  return {
    userAgent: req.headers['user-agent'] as string | undefined,
    ipAddress: req.ip,
  };
}

function envelope<T>(data: T) {
  return { data, meta: { request_id: randomBytes(16).toString('hex') } };
}

@ApiTags('CRM — Inquiries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('api/v1/inquiries')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get()
  @RequirePermissions('crm.inquiries.read')
  @ApiOperation({ summary: 'List inquiries (RBAC-scoped, filtered, paginated)' })
  @ApiOkResponse({ description: 'Paginated inquiry list' })
  async list(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: ListInquiriesQueryDto,
  ) {
    const result = await this.crm.list(tenantId, user, query);
    return {
      data: result.data,
      meta: { ...result.meta, request_id: randomBytes(16).toString('hex') },
    };
  }

  @Get('metrics')
  @RequirePermissions('crm.inquiries.read')
  @ApiOperation({ summary: 'CRM pipeline metrics (dashboard-ready, RBAC-scoped)' })
  async metrics(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return envelope(await this.crm.getMetrics(tenantId, user, { from: dateFrom, to: dateTo }));
  }

  @Post()
  @RequirePermissions('crm.inquiries.create')
  @ApiOperation({ summary: 'Create an inquiry (auto inquiry_code, BR-C01 duplicate check)' })
  @ApiCreatedResponse({ description: 'Inquiry created' })
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateInquiryDto,
    @Req() req: Request,
  ) {
    return envelope(await this.crm.create(tenantId, dto, user, requestMeta(req)));
  }

  @Get(':id')
  @RequirePermissions('crm.inquiries.read')
  @ApiOperation({ summary: 'Get inquiry by id (with notes, follow-ups, site visits)' })
  async getOne(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return envelope(await this.crm.getOne(tenantId, user, id));
  }

  @Patch(':id')
  @RequirePermissions('crm.inquiries.update')
  @ApiOperation({ summary: 'Update inquiry detail (history tracked)' })
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateInquiryDto,
    @Req() req: Request,
  ) {
    return envelope(await this.crm.update(tenantId, user, id, dto, requestMeta(req)));
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermissions('crm.inquiries.delete')
  @ApiOperation({ summary: 'Soft delete inquiry' })
  async remove(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return envelope(await this.crm.remove(tenantId, user, id, requestMeta(req)));
  }

  // --- Assignment ------------------------------------------------------------

  @Post(':id/assign')
  @RequirePermissions('crm.inquiries.assign')
  @ApiOperation({ summary: 'Assign inquiry to an employee (BR-C05)' })
  async assign(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignInquiryDto,
    @Req() req: Request,
  ) {
    return envelope(await this.crm.assign(tenantId, user, id, dto, requestMeta(req)));
  }

  // --- Stage workflow --------------------------------------------------------

  @Patch(':id/stage')
  @RequirePermissions('crm.inquiries.update')
  @ApiOperation({ summary: 'Change inquiry pipeline stage (BR-C02/C03/C04, history)' })
  async changeStage(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ChangeStageDto,
    @Req() req: Request,
  ) {
    return envelope(await this.crm.changeStage(tenantId, user, id, dto, requestMeta(req)));
  }

  // --- Notes -----------------------------------------------------------------

  @Post(':id/notes')
  @RequirePermissions('crm.notes.create')
  @ApiOperation({ summary: 'Add a note to an inquiry' })
  async addNote(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateNoteDto,
    @Req() req: Request,
  ) {
    return envelope(await this.crm.addNote(tenantId, user, id, dto, requestMeta(req)));
  }

  @Get(':id/notes')
  @RequirePermissions('crm.inquiries.read')
  @ApiOperation({ summary: 'List inquiry notes' })
  async listNotes(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return envelope(await this.crm.listNotes(tenantId, user, id));
  }

  // --- Follow-ups ------------------------------------------------------------

  @Post(':id/followups')
  @RequirePermissions('crm.followups.create')
  @ApiOperation({ summary: 'Create a follow-up for an inquiry' })
  async addFollowup(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateFollowupDto,
    @Req() req: Request,
  ) {
    return envelope(await this.crm.addFollowup(tenantId, user, id, dto, requestMeta(req)));
  }

  @Get(':id/followups')
  @RequirePermissions('crm.inquiries.read')
  @ApiOperation({ summary: 'List inquiry follow-ups' })
  async listFollowups(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return envelope(await this.crm.listFollowups(tenantId, user, id));
  }

  @Patch(':id/followups/:followupId')
  @RequirePermissions('crm.followups.update')
  @ApiOperation({ summary: 'Update a follow-up (status: complete/reschedule/miss)' })
  async updateFollowup(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('followupId') followupId: string,
    @Body() dto: UpdateFollowupDto,
    @Req() req: Request,
  ) {
    return envelope(
      await this.crm.updateFollowup(tenantId, user, id, followupId, dto, requestMeta(req)),
    );
  }

  // --- Site visits -----------------------------------------------------------

  @Post(':id/site-visits')
  @RequirePermissions('crm.sitevisits.create')
  @ApiOperation({ summary: 'Schedule a site visit for an inquiry' })
  async addSiteVisit(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateSiteVisitDto,
    @Req() req: Request,
  ) {
    return envelope(await this.crm.addSiteVisit(tenantId, user, id, dto, requestMeta(req)));
  }

  @Get(':id/site-visits')
  @RequirePermissions('crm.inquiries.read')
  @ApiOperation({ summary: 'List inquiry site visits' })
  async listSiteVisits(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return envelope(await this.crm.listSiteVisits(tenantId, user, id));
  }

  @Patch(':id/site-visits/:visitId')
  @RequirePermissions('crm.sitevisits.update')
  @ApiOperation({ summary: 'Update a site visit (status: complete/cancel/no-show)' })
  async updateSiteVisit(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('visitId') visitId: string,
    @Body() dto: UpdateSiteVisitDto,
    @Req() req: Request,
  ) {
    return envelope(
      await this.crm.updateSiteVisit(tenantId, user, id, visitId, dto, requestMeta(req)),
    );
  }

  // --- History / timeline ----------------------------------------------------

  @Get(':id/history')
  @RequirePermissions('crm.inquiries.read')
  @ApiOperation({ summary: 'Get inquiry history + activity timeline' })
  async history(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return envelope(await this.crm.getHistory(tenantId, user, id));
  }
}
