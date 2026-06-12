import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';
import type { MatchableProperty } from './engines/matching.engine';

/** Calls/conversations visibility: org-wide or only the acting user's own. */
export type AiScope = { type: 'all' } | { type: 'own'; userId: string };

function scopeWhere(scope: AiScope): Prisma.ai_callsWhereInput {
  return scope.type === 'all' ? {} : { created_by: scope.userId };
}

@Injectable()
export class AiRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.dbClient;
  }

  // --- Settings --------------------------------------------------------------

  async getSettings(tenantId: string) {
    return this.db.ai_settings.findUnique({ where: { tenant_id: tenantId } });
  }

  async upsertSettings(tenantId: string, data: Prisma.ai_settingsUncheckedUpdateInput) {
    return this.db.ai_settings.upsert({
      where: { tenant_id: tenantId },
      create: { ...(data as Prisma.ai_settingsUncheckedCreateInput), tenant_id: tenantId },
      update: data,
    });
  }

  // --- Agents ----------------------------------------------------------------

  async listAgents(tenantId: string) {
    return this.db.ai_agents.findMany({
      where: { tenant_id: tenantId, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
  }

  async createAgent(data: Prisma.ai_agentsUncheckedCreateInput) {
    return this.db.ai_agents.create({ data });
  }

  async getAgent(tenantId: string, id: string) {
    return this.db.ai_agents.findFirst({ where: { id, tenant_id: tenantId, deleted_at: null } });
  }

  async updateAgent(tenantId: string, id: string, data: Prisma.ai_agentsUncheckedUpdateInput) {
    await this.db.ai_agents.updateMany({ where: { id, tenant_id: tenantId, deleted_at: null }, data });
    return this.getAgent(tenantId, id);
  }

  async softDeleteAgent(tenantId: string, id: string) {
    await this.db.ai_agents.updateMany({
      where: { id, tenant_id: tenantId, deleted_at: null },
      data: { deleted_at: new Date() },
    });
  }

  // --- Calls -----------------------------------------------------------------

  async createCall(data: Prisma.ai_callsUncheckedCreateInput) {
    return this.db.ai_calls.create({ data });
  }

  async updateCall(tenantId: string, id: string, data: Prisma.ai_callsUncheckedUpdateInput) {
    await this.db.ai_calls.updateMany({ where: { id, tenant_id: tenantId, deleted_at: null }, data });
    return this.getCall(tenantId, id);
  }

  /** Update by provider call_sid (webhook ingest path). */
  async updateCallBySid(callSid: string, data: Prisma.ai_callsUncheckedUpdateInput) {
    const call = await this.db.ai_calls.findFirst({ where: { call_sid: callSid } });
    if (!call) return null;
    await this.db.ai_calls.update({ where: { id: call.id }, data });
    return this.db.ai_calls.findUnique({ where: { id: call.id } });
  }

  async getCall(tenantId: string, id: string) {
    return this.db.ai_calls.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      include: { transcripts: { orderBy: { offset_ms: 'asc' } }, agent: true },
    });
  }

  async listCalls(
    tenantId: string,
    scope: AiScope,
    filters: { status?: string; direction?: string; search?: string; page: number; perPage: number },
  ) {
    const where: Prisma.ai_callsWhereInput = {
      tenant_id: tenantId,
      deleted_at: null,
      ...scopeWhere(scope),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.direction ? { direction: filters.direction } : {}),
      ...(filters.search
        ? {
            OR: [
              { client_phone: { contains: filters.search, mode: 'insensitive' } },
              { client_name: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.ai_calls.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
        include: { agent: { select: { id: true, name: true } } },
      }),
      this.db.ai_calls.count({ where }),
    ]);
    return { rows, total };
  }

  async addTranscriptSegments(
    segments: Prisma.ai_call_transcriptsUncheckedCreateInput[],
  ) {
    if (!segments.length) return;
    await this.db.ai_call_transcripts.createMany({ data: segments });
  }

  // --- AI chat conversations -------------------------------------------------

  async createAiConversation(data: Prisma.ai_conversationsUncheckedCreateInput) {
    return this.db.ai_conversations.create({ data });
  }

  async getAiConversation(tenantId: string, id: string) {
    return this.db.ai_conversations.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      include: { messages: { orderBy: { created_at: 'asc' } } },
    });
  }

  async listAiConversations(tenantId: string, page: number, perPage: number) {
    const where: Prisma.ai_conversationsWhereInput = { tenant_id: tenantId, deleted_at: null };
    const [rows, total] = await Promise.all([
      this.db.ai_conversations.findMany({
        where,
        orderBy: { updated_at: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.db.ai_conversations.count({ where }),
    ]);
    return { rows, total };
  }

  async appendAiMessage(data: Prisma.ai_messagesUncheckedCreateInput) {
    return this.db.ai_messages.create({ data });
  }

  async updateAiConversation(
    tenantId: string,
    id: string,
    data: Prisma.ai_conversationsUncheckedUpdateInput,
  ) {
    await this.db.ai_conversations.updateMany({ where: { id, tenant_id: tenantId }, data });
    return this.getAiConversation(tenantId, id);
  }

  // --- Knowledge base --------------------------------------------------------

  async createKnowledge(data: Prisma.ai_knowledge_documentsUncheckedCreateInput) {
    return this.db.ai_knowledge_documents.create({ data });
  }

  async listKnowledge(
    tenantId: string,
    filters: { type?: string; search?: string; page: number; perPage: number },
  ) {
    const where: Prisma.ai_knowledge_documentsWhereInput = {
      tenant_id: tenantId,
      deleted_at: null,
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' } },
              { content: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.ai_knowledge_documents.findMany({
        where,
        orderBy: { updated_at: 'desc' },
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
      this.db.ai_knowledge_documents.count({ where }),
    ]);
    return { rows, total };
  }

  async getKnowledge(tenantId: string, id: string) {
    return this.db.ai_knowledge_documents.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
    });
  }

  async updateKnowledge(
    tenantId: string,
    id: string,
    data: Prisma.ai_knowledge_documentsUncheckedUpdateInput,
  ) {
    await this.db.ai_knowledge_documents.updateMany({
      where: { id, tenant_id: tenantId, deleted_at: null },
      data,
    });
    return this.getKnowledge(tenantId, id);
  }

  async softDeleteKnowledge(tenantId: string, id: string) {
    await this.db.ai_knowledge_documents.updateMany({
      where: { id, tenant_id: tenantId, deleted_at: null },
      data: { deleted_at: new Date() },
    });
  }

  /** Active knowledge docs (with embeddings) for RAG retrieval. */
  async listActiveKnowledge(tenantId: string, type?: string, max = 500) {
    return this.db.ai_knowledge_documents.findMany({
      where: { tenant_id: tenantId, deleted_at: null, is_active: true, ...(type ? { type } : {}) },
      take: max,
      select: { id: true, type: true, title: true, content: true, embedding: true, embedding_model: true },
    });
  }

  // --- Prompt templates ------------------------------------------------------

  async listPrompts(tenantId: string) {
    return this.db.ai_prompt_templates.findMany({
      where: { OR: [{ tenant_id: tenantId }, { tenant_id: null }], deleted_at: null },
      orderBy: [{ tenant_id: 'desc' }, { key: 'asc' }],
    });
  }

  /** Resolve a prompt by key: tenant override wins, else system default. */
  async resolvePrompt(tenantId: string, key: string) {
    const tenantPrompt = await this.db.ai_prompt_templates.findFirst({
      where: { tenant_id: tenantId, key, deleted_at: null, is_active: true },
    });
    if (tenantPrompt) return tenantPrompt;
    return this.db.ai_prompt_templates.findFirst({
      where: { tenant_id: null, key, deleted_at: null, is_active: true },
    });
  }

  async upsertPrompt(tenantId: string, key: string, data: Prisma.ai_prompt_templatesUncheckedCreateInput) {
    const existing = await this.db.ai_prompt_templates.findFirst({ where: { tenant_id: tenantId, key } });
    if (existing) {
      await this.db.ai_prompt_templates.update({ where: { id: existing.id }, data });
      return this.db.ai_prompt_templates.findUnique({ where: { id: existing.id } });
    }
    return this.db.ai_prompt_templates.create({ data: { ...data, tenant_id: tenantId, key } });
  }

  // --- Follow-up suggestions -------------------------------------------------

  async createFollowupSuggestion(data: Prisma.ai_followup_suggestionsUncheckedCreateInput) {
    return this.db.ai_followup_suggestions.create({ data });
  }

  async listFollowupSuggestions(
    tenantId: string,
    filters: { status?: string; inquiryId?: string; page: number; perPage: number },
  ) {
    const where: Prisma.ai_followup_suggestionsWhereInput = {
      tenant_id: tenantId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.inquiryId ? { inquiry_id: filters.inquiryId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.ai_followup_suggestions.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
      this.db.ai_followup_suggestions.count({ where }),
    ]);
    return { rows, total };
  }

  async getFollowupSuggestion(tenantId: string, id: string) {
    return this.db.ai_followup_suggestions.findFirst({ where: { id, tenant_id: tenantId } });
  }

  async updateFollowupSuggestion(
    tenantId: string,
    id: string,
    data: Prisma.ai_followup_suggestionsUncheckedUpdateInput,
  ) {
    await this.db.ai_followup_suggestions.updateMany({ where: { id, tenant_id: tenantId }, data });
    return this.getFollowupSuggestion(tenantId, id);
  }

  // --- Usage + analytics -----------------------------------------------------

  async recordUsage(data: Prisma.ai_usage_eventsUncheckedCreateInput) {
    return this.db.ai_usage_events.create({ data });
  }

  async incrementAiMinutes(tenantId: string, minutes: number) {
    try {
      await this.db.organization_usage.update({
        where: { tenant_id: tenantId },
        data: { ai_minutes_used: { increment: Math.max(0, Math.round(minutes)) } },
      });
    } catch {
      // Usage row may not exist for legacy tenants — non-fatal.
    }
  }

  async analyticsSnapshot(tenantId: string, since: Date) {
    const [
      callsTotal,
      callsCompleted,
      qualifiedCalls,
      conversationsTotal,
      handoffs,
      convertedConversations,
      knowledgeCount,
      usage,
      tempGroups,
    ] = await Promise.all([
      this.db.ai_calls.count({ where: { tenant_id: tenantId, deleted_at: null, created_at: { gte: since } } }),
      this.db.ai_calls.count({
        where: { tenant_id: tenantId, deleted_at: null, status: 'completed', created_at: { gte: since } },
      }),
      this.db.ai_calls.count({
        where: { tenant_id: tenantId, deleted_at: null, temperature: 'hot', created_at: { gte: since } },
      }),
      this.db.ai_conversations.count({
        where: { tenant_id: tenantId, deleted_at: null, created_at: { gte: since } },
      }),
      this.db.ai_conversations.count({
        where: { tenant_id: tenantId, deleted_at: null, handoff_requested: true, created_at: { gte: since } },
      }),
      this.db.ai_conversations.count({
        where: { tenant_id: tenantId, deleted_at: null, inquiry_id: { not: null }, created_at: { gte: since } },
      }),
      this.db.ai_knowledge_documents.count({ where: { tenant_id: tenantId, deleted_at: null, is_active: true } }),
      this.db.ai_usage_events.aggregate({
        where: { tenant_id: tenantId, created_at: { gte: since } },
        _sum: { total_tokens: true, cost_usd: true },
      }),
      this.db.ai_calls.groupBy({
        by: ['temperature'],
        where: { tenant_id: tenantId, deleted_at: null, created_at: { gte: since }, temperature: { not: null } },
        _count: { _all: true },
      }),
    ]);

    return {
      callsTotal,
      callsCompleted,
      qualifiedCalls,
      conversationsTotal,
      handoffs,
      convertedConversations,
      knowledgeCount,
      totalTokens: usage._sum.total_tokens ?? 0,
      costUsd: usage._sum.cost_usd ? Number(usage._sum.cost_usd) : 0,
      temperatureBreakdown: tempGroups.map((g) => ({
        temperature: g.temperature,
        count: g._count._all,
      })),
    };
  }

  // --- Cross-aggregate read model (properties / inquiries) -------------------

  /** Read-only property candidates for matching (analytics-style read model). */
  async findMatchableProperties(
    tenantId: string,
    hint: { city?: string | null; propertyType?: string | null; requirementType?: string | null },
    max = 100,
  ): Promise<MatchableProperty[]> {
    const rows = await this.db.properties.findMany({
      where: {
        tenant_id: tenantId,
        deleted_at: null,
        status: { in: ['published', 'reserved'] },
        ...(hint.city ? { city: { equals: hint.city, mode: 'insensitive' } } : {}),
        ...(hint.propertyType ? { type: hint.propertyType } : {}),
        ...(hint.requirementType ? { requirement_type: hint.requirementType } : {}),
      },
      take: max,
      include: { amenities: { select: { name: true } } },
    });
    return rows.map((p) => ({
      id: p.id,
      title: p.title,
      property_code: p.property_code,
      slug: p.slug,
      city: p.city,
      type: p.type,
      category: p.category,
      requirement_type: p.requirement_type,
      price: p.price != null ? Number(p.price) : null,
      bedrooms: p.bedrooms ?? null,
      amenities: p.amenities.map((a) => a.name),
    }));
  }

  async findInquiryBasic(tenantId: string, inquiryId: string) {
    return this.db.inquiries.findFirst({
      where: { id: inquiryId, tenant_id: tenantId, deleted_at: null },
      select: {
        id: true,
        client_name: true,
        phone: true,
        budget_min: true,
        budget_max: true,
        preferred_location: true,
        property_type: true,
        requirement_type: true,
        bedrooms: true,
        stage: true,
        assigned_employee_id: true,
        updated_at: true,
      },
    });
  }

  /** Open inquiries with no recent activity — feed re-engagement follow-ups. */
  async findStaleOpenInquiries(tenantId: string, staleBefore: Date, max = 50) {
    return this.db.inquiries.findMany({
      where: {
        tenant_id: tenantId,
        deleted_at: null,
        stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] },
        updated_at: { lt: staleBefore },
      },
      orderBy: { updated_at: 'asc' },
      take: max,
      select: {
        id: true,
        client_name: true,
        phone: true,
        stage: true,
        preferred_location: true,
        updated_at: true,
      },
    });
  }
}
