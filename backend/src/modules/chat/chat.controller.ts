import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
import { ChatService } from './chat.service';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { CloseConversationDto } from './dto/close-conversation.dto';
import { ConvertInquiryDto } from './dto/convert-inquiry.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { SendPublicChatMessageDto, StartPublicChatDto } from './dto/public-chat.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

function requestMeta(req: Request) {
  return {
    userAgent: req.headers['user-agent'] as string | undefined,
    ipAddress: req.ip,
  };
}

function envelope<T>(data: T) {
  return { data, meta: { request_id: randomBytes(16).toString('hex') } };
}

@ApiTags('Chat — Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('chat')
@Controller('api/v1/conversations')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  @RequirePermissions('chat.conversations.read')
  @ApiOperation({ summary: 'List conversations (RBAC-scoped, filtered, paginated)' })
  @ApiOkResponse({ description: 'Paginated conversation list' })
  async list(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: ListConversationsQueryDto,
  ) {
    const result = await this.chat.list(tenantId, user, query);
    return {
      data: result.data,
      meta: { ...result.meta, request_id: randomBytes(16).toString('hex') },
    };
  }

  @Get('unread-count')
  @RequirePermissions('chat.conversations.read')
  @ApiOperation({ summary: 'Unread conversation count for the current user' })
  async unreadCount(@TenantId() tenantId: string, @CurrentUser() user: AuthUser) {
    return envelope(await this.chat.unreadCount(tenantId, user));
  }

  @Post()
  @RequirePermissions('chat.conversations.create')
  @ApiOperation({ summary: 'Create a conversation (optionally with initial message)' })
  @ApiCreatedResponse({ description: 'Conversation created' })
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateConversationDto,
    @Req() req: Request,
  ) {
    return envelope(await this.chat.create(tenantId, dto, user, requestMeta(req)));
  }

  @Get(':id')
  @RequirePermissions('chat.conversations.read')
  @ApiOperation({ summary: 'Get conversation by id (with participants + context)' })
  async getOne(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return envelope(await this.chat.getOne(tenantId, user, id));
  }

  @Patch(':id')
  @RequirePermissions('chat.conversations.update')
  @ApiOperation({ summary: 'Update conversation metadata / status / tags' })
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateConversationDto,
    @Req() req: Request,
  ) {
    return envelope(await this.chat.update(tenantId, user, id, dto, requestMeta(req)));
  }

  @Post(':id/assign')
  @RequirePermissions('chat.conversations.assign')
  @ApiOperation({ summary: 'Assign conversation to an employee' })
  async assign(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignConversationDto,
    @Req() req: Request,
  ) {
    return envelope(await this.chat.assign(tenantId, user, id, dto, requestMeta(req)));
  }

  @Post(':id/close')
  @RequirePermissions('chat.conversations.update')
  @ApiOperation({ summary: 'Close or archive a conversation' })
  async close(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CloseConversationDto,
    @Req() req: Request,
  ) {
    return envelope(await this.chat.close(tenantId, user, id, dto, requestMeta(req)));
  }

  @Post(':id/convert-inquiry')
  @RequirePermissions('chat.conversations.convert')
  @ApiOperation({ summary: 'Convert conversation to CRM inquiry (or link existing)' })
  async convertInquiry(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ConvertInquiryDto,
    @Req() req: Request,
  ) {
    return envelope(await this.chat.convertToInquiry(tenantId, user, id, dto, requestMeta(req)));
  }

  @Get(':id/messages')
  @RequirePermissions('chat.messages.read')
  @ApiOperation({ summary: 'List messages in a conversation (newest first)' })
  async listMessages(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    const result = await this.chat.listMessages(tenantId, user, id, query);
    return {
      data: result.data,
      meta: { ...result.meta, request_id: randomBytes(16).toString('hex') },
    };
  }

  @Post(':id/messages')
  @RequirePermissions('chat.messages.send')
  @ApiOperation({ summary: 'Send a message (text + optional attachments)' })
  @ApiCreatedResponse({ description: 'Message sent' })
  async sendMessage(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @Req() req: Request,
  ) {
    return envelope(await this.chat.sendMessage(tenantId, user, id, dto, requestMeta(req)));
  }

  @Get(':id/activities')
  @RequirePermissions('chat.conversations.read')
  @ApiOperation({ summary: 'Conversation activity + assignment history (sidebar)' })
  async activities(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return envelope(await this.chat.getActivities(tenantId, user, id));
  }
}

@ApiTags('Chat — Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('chat')
@Controller('api/v1/messages')
export class ChatMessagesController {
  constructor(private readonly chat: ChatService) {}

  @Patch(':id/read')
  @HttpCode(200)
  @RequirePermissions('chat.messages.read')
  @ApiOperation({ summary: 'Mark a message (and conversation) as read for the current user' })
  async markRead(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return envelope(await this.chat.markMessageRead(tenantId, user, id, requestMeta(req)));
  }
}

@ApiTags('Public Chat')
@Controller('api/v1/public/chat')
export class PublicChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('conversations')
  @Throttle({ public_chat: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Start a public website chat conversation' })
  @ApiCreatedResponse({ description: 'Conversation created with visitor token' })
  async start(@Body() dto: StartPublicChatDto, @Req() req: Request) {
    return envelope(await this.chat.startPublicConversation(dto, requestMeta(req)));
  }

  @Get('conversations/:id/messages')
  @Throttle({ public_chat: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'List messages visible to the public chat visitor' })
  async listMessages(
    @Param('id') id: string,
    @Query('token') token: string | undefined,
    @Req() req: Request,
  ) {
    const result = await this.chat.listPublicMessages(id, token ?? bearerToken(req), {
      page: 1,
      per_page: 50,
    });
    return {
      data: result.data,
      meta: { ...result.meta, request_id: randomBytes(16).toString('hex') },
    };
  }

  @Post('conversations/:id/messages')
  @Throttle({ public_chat: { limit: 12, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a public website chat message' })
  async sendMessage(
    @Param('id') id: string,
    @Body() dto: SendPublicChatMessageDto,
    @Req() req: Request,
  ) {
    return envelope(await this.chat.sendPublicMessage(id, bearerToken(req), dto, requestMeta(req)));
  }
}

function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  return header.replace(/^Bearer\s+/i, '');
}
