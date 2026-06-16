import {
  Body,
  Controller,
  Get,
  Param,
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
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import type { AuthUser } from '../../common/context/auth-user';
import { FeatureFlagGuard } from '../../common/guards/feature-flag.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AI_PERMISSIONS } from './ai.constants';
import { AiChatMessageDto, StartAiChatDto } from './dto/ai-chat.dto';
import { CreateAgentDto, UpdateAgentDto } from './dto/ai-agent.dto';
import { CreateCallDto } from './dto/ai-call.dto';
import { ListCallsQueryDto } from './dto/followup.dto';
import { AnalyzeConversationDto } from './dto/intelligence.dto';
import { MatchDto } from './dto/match.dto';
import { QualifyTextDto } from './dto/qualify.dto';
import { AiAnalyticsService } from './services/ai-analytics.service';
import { AiCallService } from './services/ai-call.service';
import { AiChatService } from './services/ai-chat.service';
import { ConversationIntelligenceService } from './services/conversation-intelligence.service';
import { LeadQualificationService } from './services/lead-qualification.service';
import { PropertyMatchingService } from './services/property-matching.service';

function envelope<T>(data: T) {
  return { data, meta: { request_id: randomBytes(16).toString('hex') } };
}

function requestMeta(req: Request) {
  return { userAgent: req.headers['user-agent'] as string | undefined, ipAddress: req.ip };
}

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('ai')
@Controller('api/v1/ai')
export class AiController {
  constructor(
    private readonly qualification: LeadQualificationService,
    private readonly matching: PropertyMatchingService,
    private readonly intelligence: ConversationIntelligenceService,
    private readonly analytics: AiAnalyticsService,
  ) {}

  @Get('dashboard')
  @RequirePermissions(AI_PERMISSIONS.DASHBOARD_READ)
  @ApiOperation({ summary: 'AI agent platform dashboard metrics' })
  async dashboard(@TenantId() tenantId: string, @Query('range') range?: string) {
    return envelope(await this.analytics.dashboard(tenantId, range));
  }

  @Get('analytics')
  @RequirePermissions(AI_PERMISSIONS.ANALYTICS_READ)
  @ApiOperation({ summary: 'AI conversation, conversion, and cost analytics' })
  async analyticsView(@TenantId() tenantId: string, @Query('range') range?: string) {
    return envelope(await this.analytics.dashboard(tenantId, range));
  }

  @Post('qualify')
  @RequirePermissions(AI_PERMISSIONS.QUALIFY)
  @ApiOperation({ summary: 'Qualify a lead from conversation text (extract + score)' })
  async qualify(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: QualifyTextDto,
    @Req() req: Request,
  ) {
    return envelope(await this.qualification.qualifyText(tenantId, dto, user, requestMeta(req)));
  }

  @Post('match')
  @RequirePermissions(AI_PERMISSIONS.MATCH)
  @ApiOperation({ summary: 'Match requirements/inquiry to properties with reasoning' })
  async match(@TenantId() tenantId: string, @Body() dto: MatchDto) {
    return envelope(await this.matching.match(tenantId, dto));
  }

  @Post('intelligence')
  @RequirePermissions(AI_PERMISSIONS.INTELLIGENCE_READ)
  @ApiOperation({ summary: 'Conversation intelligence: objections, signals, risks, actions' })
  async analyze(@TenantId() tenantId: string, @Body() dto: AnalyzeConversationDto) {
    return envelope(await this.intelligence.analyze(tenantId, dto));
  }
}

@ApiTags('AI Voice Agents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('ai')
@Controller('api/v1/ai/agents')
export class AiAgentsController {
  constructor(private readonly calls: AiCallService) {}

  @Get()
  @RequirePermissions(AI_PERMISSIONS.CALLS_READ)
  @ApiOperation({ summary: 'List AI voice/chat agents' })
  async list(@TenantId() tenantId: string) {
    return envelope(await this.calls.listAgents(tenantId));
  }

  @Post()
  @RequirePermissions(AI_PERMISSIONS.AGENTS_MANAGE)
  @ApiOperation({ summary: 'Create an AI agent' })
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAgentDto,
    @Req() req: Request,
  ) {
    return envelope(await this.calls.createAgent(tenantId, dto, user, requestMeta(req)));
  }

  @Post(':id')
  @RequirePermissions(AI_PERMISSIONS.AGENTS_MANAGE)
  @ApiOperation({ summary: 'Update an AI agent' })
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAgentDto,
    @Req() req: Request,
  ) {
    return envelope(await this.calls.updateAgent(tenantId, id, dto, user, requestMeta(req)));
  }
}

@ApiTags('AI Calls')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('ai')
@Controller('api/v1/ai/calls')
export class AiCallsController {
  constructor(private readonly calls: AiCallService) {}

  @Get()
  @RequirePermissions(AI_PERMISSIONS.CALLS_READ)
  @ApiOperation({ summary: 'List AI calls (RBAC-scoped)' })
  async list(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: ListCallsQueryDto,
  ) {
    return envelope(await this.calls.listCalls(tenantId, user, query));
  }

  @Post()
  @RequirePermissions(AI_PERMISSIONS.CALLS_CREATE)
  @ApiOperation({ summary: 'Initiate an AI call (inbound/outbound)' })
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCallDto,
    @Req() req: Request,
  ) {
    return envelope(await this.calls.initiateCall(tenantId, dto, user, requestMeta(req)));
  }

  @Get(':id')
  @RequirePermissions(AI_PERMISSIONS.CALLS_READ)
  @ApiOperation({ summary: 'Get AI call detail' })
  async get(@TenantId() tenantId: string, @Param('id') id: string) {
    return envelope(await this.calls.getCall(tenantId, id));
  }

  @Get(':id/transcript')
  @RequirePermissions(AI_PERMISSIONS.CALLS_READ)
  @ApiOperation({ summary: 'Get full AI call transcript' })
  async transcript(@TenantId() tenantId: string, @Param('id') id: string) {
    return envelope(await this.calls.getTranscript(tenantId, id));
  }
}

@ApiTags('AI Chat Assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('ai')
@Controller('api/v1/ai/chat')
export class AiChatController {
  constructor(private readonly chat: AiChatService) {}

  @Get()
  @RequirePermissions(AI_PERMISSIONS.CHAT_USE)
  @ApiOperation({ summary: 'List AI chat conversations' })
  async list(
    @TenantId() tenantId: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
  ) {
    return envelope(await this.chat.list(tenantId, Number(page) || 1, Number(perPage) || 20));
  }

  @Post()
  @RequirePermissions(AI_PERMISSIONS.CHAT_USE)
  @ApiOperation({ summary: 'Start an AI chat assistant session' })
  async start(@TenantId() tenantId: string, @Body() dto: StartAiChatDto) {
    return envelope(await this.chat.start(tenantId, dto));
  }

  @Get(':id')
  @RequirePermissions(AI_PERMISSIONS.CHAT_USE)
  @ApiOperation({ summary: 'Get an AI chat conversation' })
  async get(@TenantId() tenantId: string, @Param('id') id: string) {
    return envelope(await this.chat.getConversation(tenantId, id));
  }

  @Post(':id/messages')
  @RequirePermissions(AI_PERMISSIONS.CHAT_USE)
  @ApiOperation({ summary: 'Send a message to the AI chat assistant' })
  async message(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AiChatMessageDto,
  ) {
    return envelope(await this.chat.sendMessage(tenantId, id, dto));
  }
}
