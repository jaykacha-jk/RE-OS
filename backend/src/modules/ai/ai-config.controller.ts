import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import type { AuthUser } from '../../common/context/auth-user';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AI_PERMISSIONS } from './ai.constants';
import { CallWebhookDto } from './dto/ai-call.dto';
import { UpdateAiSettingsDto } from './dto/ai-settings.dto';
import { GenerateFollowupsDto, ListFollowupsQueryDto, UpdateFollowupStatusDto } from './dto/followup.dto';
import {
  CreateKnowledgeDto,
  KnowledgeSearchDto,
  ListKnowledgeQueryDto,
  UpdateKnowledgeDto,
} from './dto/knowledge.dto';
import { UpsertPromptDto } from './dto/prompt.dto';
import { AiCallService } from './services/ai-call.service';
import { AiSettingsService } from './services/ai-settings.service';
import { FollowupAutomationService } from './services/followup-automation.service';
import { KnowledgeBaseService } from './services/knowledge-base.service';
import { PromptService } from './services/prompt.service';

function envelope<T>(data: T) {
  return { data, meta: { request_id: randomBytes(16).toString('hex') } };
}

function requestMeta(req: Request) {
  return { userAgent: req.headers['user-agent'] as string | undefined, ipAddress: req.ip };
}

@ApiTags('AI Knowledge Base')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('api/v1/ai/knowledge')
export class AiKnowledgeController {
  constructor(private readonly knowledge: KnowledgeBaseService) {}

  @Get()
  @RequirePermissions(AI_PERMISSIONS.KNOWLEDGE_READ)
  @ApiOperation({ summary: 'List knowledge documents' })
  async list(@TenantId() tenantId: string, @Query() query: ListKnowledgeQueryDto) {
    return envelope(await this.knowledge.list(tenantId, query));
  }

  @Post('search')
  @RequirePermissions(AI_PERMISSIONS.KNOWLEDGE_READ)
  @ApiOperation({ summary: 'Semantic search (RAG) over the knowledge base' })
  async search(@TenantId() tenantId: string, @Body() dto: KnowledgeSearchDto) {
    return envelope(await this.knowledge.search(tenantId, dto.query, dto.type, dto.limit ?? 5));
  }

  @Post()
  @RequirePermissions(AI_PERMISSIONS.KNOWLEDGE_MANAGE)
  @ApiOperation({ summary: 'Create a knowledge document (auto-embedded)' })
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateKnowledgeDto,
    @Req() req: Request,
  ) {
    return envelope(await this.knowledge.create(tenantId, dto, user, requestMeta(req)));
  }

  @Get(':id')
  @RequirePermissions(AI_PERMISSIONS.KNOWLEDGE_READ)
  @ApiOperation({ summary: 'Get a knowledge document' })
  async get(@TenantId() tenantId: string, @Param('id') id: string) {
    return envelope(await this.knowledge.getOne(tenantId, id));
  }

  @Patch(':id')
  @RequirePermissions(AI_PERMISSIONS.KNOWLEDGE_MANAGE)
  @ApiOperation({ summary: 'Update a knowledge document (re-embeds on text change)' })
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeDto,
    @Req() req: Request,
  ) {
    return envelope(await this.knowledge.update(tenantId, id, dto, user, requestMeta(req)));
  }

  @Delete(':id')
  @RequirePermissions(AI_PERMISSIONS.KNOWLEDGE_MANAGE)
  @ApiOperation({ summary: 'Delete a knowledge document' })
  async remove(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return envelope(await this.knowledge.remove(tenantId, id, user, requestMeta(req)));
  }
}

@ApiTags('AI Prompt Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('api/v1/ai/prompts')
export class AiPromptsController {
  constructor(private readonly prompts: PromptService) {}

  @Get()
  @RequirePermissions(AI_PERMISSIONS.PROMPTS_MANAGE)
  @ApiOperation({ summary: 'List AI prompt templates (system + tenant)' })
  async list(@TenantId() tenantId: string) {
    return envelope(await this.prompts.list(tenantId));
  }

  @Post()
  @RequirePermissions(AI_PERMISSIONS.PROMPTS_MANAGE)
  @ApiOperation({ summary: 'Create or update a tenant prompt template' })
  async upsert(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertPromptDto,
    @Req() req: Request,
  ) {
    return envelope(await this.prompts.upsert(tenantId, dto, user, requestMeta(req)));
  }
}

@ApiTags('AI Follow-ups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('api/v1/ai/followups')
export class AiFollowupsController {
  constructor(private readonly followups: FollowupAutomationService) {}

  @Get()
  @RequirePermissions(AI_PERMISSIONS.FOLLOWUPS_READ)
  @ApiOperation({ summary: 'List AI follow-up suggestions' })
  async list(@TenantId() tenantId: string, @Query() query: ListFollowupsQueryDto) {
    return envelope(await this.followups.list(tenantId, query));
  }

  @Post('generate')
  @RequirePermissions(AI_PERMISSIONS.FOLLOWUPS_MANAGE)
  @ApiOperation({ summary: 'Generate follow-up suggestions (inquiry or stale scan)' })
  async generate(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: GenerateFollowupsDto,
    @Req() req: Request,
  ) {
    return envelope(await this.followups.generate(tenantId, dto, user, requestMeta(req)));
  }

  @Patch(':id')
  @RequirePermissions(AI_PERMISSIONS.FOLLOWUPS_MANAGE)
  @ApiOperation({ summary: 'Accept / dismiss / apply a follow-up suggestion' })
  async updateStatus(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateFollowupStatusDto,
    @Req() req: Request,
  ) {
    return envelope(await this.followups.updateStatus(tenantId, id, dto.status, user, requestMeta(req)));
  }
}

@ApiTags('AI Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('api/v1/ai/settings')
export class AiSettingsController {
  constructor(private readonly settings: AiSettingsService) {}

  @Get()
  @RequirePermissions(AI_PERMISSIONS.SETTINGS_READ)
  @ApiOperation({ summary: 'Get resolved AI settings for the tenant' })
  async get(@TenantId() tenantId: string) {
    return envelope(await this.settings.resolve(tenantId));
  }

  @Patch()
  @RequirePermissions(AI_PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Update AI settings for the tenant' })
  async update(@TenantId() tenantId: string, @Body() dto: UpdateAiSettingsDto) {
    return envelope(await this.settings.update(tenantId, dto));
  }
}

@ApiTags('AI Webhooks')
@Controller('api/v1/ai/webhooks')
export class AiWebhookController {
  constructor(private readonly calls: AiCallService) {}

  @Post('voice')
  @ApiOperation({ summary: 'Telephony provider webhook (status + recording ready)' })
  async voice(@Body() dto: CallWebhookDto, @Headers('x-ai-signature') signature?: string) {
    return envelope(await this.calls.handleWebhook(dto, signature));
  }
}
