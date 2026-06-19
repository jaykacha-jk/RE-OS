import { Injectable, NotFoundException } from '@nestjs/common';

import { QuotaService } from '../../billing/quota.service';
import { AI_FEATURES, PROMPT_KEYS } from '../ai.constants';
import { AiRepository } from '../ai.repository';
import { AiChatMessageDto, StartAiChatDto } from '../dto/ai-chat.dto';
import { extractRequirements } from '../engines/qualification.engine';
import type { LlmMessage } from '../providers/ai-provider.types';
import { AiProviderFactory } from '../providers/ai-provider.factory';
import { AiSettingsService } from './ai-settings.service';
import { AiUsageService } from './ai-usage.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { PromptService } from './prompt.service';

const DEFAULT_CHAT_SYSTEM_PROMPT = `You are a helpful, concise real-estate sales assistant for an Indian property agency.
Help website and CRM visitors with property availability, pricing, FAQs, and booking site visits.
Use the provided KNOWLEDGE CONTEXT when answering. If you do not know, say so and offer to connect a human advisor.
Always try to capture the visitor's budget, preferred location, and property type. Keep replies under 80 words.`;

export interface AiChatReply {
  ai_conversation_id: string;
  reply: string;
  handoff_requested: boolean;
  sources: Array<{ id: string; title: string; score: number }>;
  captured_requirements: ReturnType<typeof extractRequirements>;
}

@Injectable()
export class AiChatService {
  constructor(
    private readonly repo: AiRepository,
    private readonly factory: AiProviderFactory,
    private readonly settings: AiSettingsService,
    private readonly knowledge: KnowledgeBaseService,
    private readonly prompts: PromptService,
    private readonly usage: AiUsageService,
    private readonly quota: QuotaService,
  ) {}

  async start(tenantId: string, dto: StartAiChatDto): Promise<AiChatReply | { ai_conversation_id: string }> {
    const conv = await this.repo.createAiConversation({
      tenant_id: tenantId,
      channel: dto.channel ?? 'website',
      conversation_id: dto.conversation_id ?? null,
      inquiry_id: dto.inquiry_id ?? null,
      client_name: dto.client_name ?? null,
      client_phone: dto.client_phone ?? null,
      status: 'active',
    });
    if (dto.message) {
      return this.sendMessage(tenantId, conv.id, { message: dto.message });
    }
    return { ai_conversation_id: conv.id };
  }

  async getConversation(tenantId: string, id: string) {
    const conv = await this.repo.getAiConversation(tenantId, id);
    if (!conv) throw new NotFoundException('AI conversation not found');
    return {
      id: conv.id,
      channel: conv.channel,
      status: conv.status,
      handoff_requested: conv.handoff_requested,
      summary: conv.summary,
      client_name: conv.client_name,
      client_phone: conv.client_phone,
      messages: conv.messages.map((m) => ({
        role: m.role,
        content: m.content,
        created_at: m.created_at.toISOString(),
      })),
    };
  }

  async list(tenantId: string, page = 1, perPage = 20) {
    const { rows, total } = await this.repo.listAiConversations(tenantId, page, perPage);
    return {
      data: rows.map((c) => ({
        id: c.id,
        channel: c.channel,
        status: c.status,
        handoff_requested: c.handoff_requested,
        messages_count: c.messages_count,
        client_name: c.client_name,
        updated_at: c.updated_at.toISOString(),
      })),
      meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) || 1 },
    };
  }

  async sendMessage(tenantId: string, id: string, dto: AiChatMessageDto): Promise<AiChatReply> {
    const conv = await this.repo.getAiConversation(tenantId, id);
    if (!conv) throw new NotFoundException('AI conversation not found');

    await this.quota.assertAiMinutesAvailable(tenantId, 1);

    const resolved = await this.settings.resolve(tenantId);
    const bundle = this.factory.bundle(resolved.provider);

    await this.repo.appendAiMessage({
      tenant_id: tenantId,
      ai_conversation_id: id,
      role: 'user',
      content: dto.message,
    });

    // BR-AI05: human handoff on keyword match.
    const handoff =
      conv.handoff_requested ||
      resolved.handoff_keywords.some((kw) => dto.message.toLowerCase().includes(kw.toLowerCase()));

    // RAG retrieval.
    const sources = await this.knowledge.search(tenantId, dto.message, undefined, 3);
    const knowledgeContext = sources.map((s) => `- ${s.title}: ${s.content}`).join('\n');

    const systemPrompt = await this.prompts.resolveSystemPrompt(
      tenantId,
      PROMPT_KEYS.CHAT_ASSISTANT,
      DEFAULT_CHAT_SYSTEM_PROMPT,
    );

    const history: LlmMessage[] = conv.messages
      .slice(-8)
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

    const messages: LlmMessage[] = [
      {
        role: 'system',
        content: knowledgeContext
          ? `${systemPrompt}\n\nKNOWLEDGE CONTEXT:\n${knowledgeContext}`
          : systemPrompt,
      },
      ...history,
      { role: 'user', content: dto.message },
    ];

    let reply: string;
    let usageTokens;
    let providerName = bundle.llm.name;
    let model: string | undefined;
    try {
      const completion = await bundle.llm.complete({ messages, temperature: 0.3 });
      reply = completion.content.trim();
      usageTokens = completion.usage;
      model = completion.model;
    } catch {
      // Resilience: never fail a chat turn — fall back to a safe handoff reply.
      reply = 'Let me connect you with one of our property advisors who can help further.';
      providerName = bundle.llm.name;
    }
    if (handoff && !/advisor|human|connect/i.test(reply)) {
      reply = `${reply}\n\nI'm connecting you with a human advisor now.`;
    }

    await this.repo.appendAiMessage({
      tenant_id: tenantId,
      ai_conversation_id: id,
      role: 'assistant',
      content: reply,
      tokens: usageTokens?.completionTokens ?? 0,
    });

    // Lead capture: extract requirements from the full client side of the chat.
    const clientText = [...conv.messages.filter((m) => m.role === 'user').map((m) => m.content), dto.message].join(
      ' ',
    );
    const captured = extractRequirements(clientText);

    await this.repo.updateAiConversation(tenantId, id, {
      messages_count: { increment: 2 },
      handoff_requested: handoff,
      status: handoff ? 'handoff' : 'active',
      metadata: { captured_requirements: captured as object } as object,
    });

    await this.usage.record({
      tenantId,
      feature: AI_FEATURES.CHAT,
      provider: providerName,
      model,
      usage: usageTokens,
      entityType: 'ai_conversation',
      entityId: id,
      outcome: handoff ? 'handoff' : 'success',
    });

    await this.quota.recordAiMinutes(tenantId, 1);

    return {
      ai_conversation_id: id,
      reply,
      handoff_requested: handoff,
      sources: sources.map((s) => ({ id: s.id, title: s.title, score: s.score })),
      captured_requirements: captured,
    };
  }
}
