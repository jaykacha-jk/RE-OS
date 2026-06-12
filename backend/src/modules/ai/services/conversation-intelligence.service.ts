import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { AI_FEATURES } from '../ai.constants';
import { AiRepository } from '../ai.repository';
import { AnalyzeConversationDto } from '../dto/intelligence.dto';
import { analyzeConversation, type IntelligenceResult } from '../engines/intelligence.engine';
import { AiSettingsService } from './ai-settings.service';
import { AiUsageService } from './ai-usage.service';

@Injectable()
export class ConversationIntelligenceService {
  constructor(
    private readonly repo: AiRepository,
    private readonly settings: AiSettingsService,
    private readonly usage: AiUsageService,
  ) {}

  async analyze(
    tenantId: string,
    dto: AnalyzeConversationDto,
  ): Promise<IntelligenceResult & { source: string }> {
    const { text, source } = await this.resolveText(tenantId, dto);
    if (!text.trim()) throw new BadRequestException('No conversation content to analyze');

    const result = analyzeConversation(text);
    const resolved = await this.settings.resolve(tenantId);

    await this.usage.record({
      tenantId,
      feature: AI_FEATURES.INTELLIGENCE,
      provider: resolved.provider,
      entityType: source,
      entityId: dto.call_id ?? dto.ai_conversation_id ?? null,
      outcome: result.buying_signals.length ? 'qualified' : 'success',
      metadata: {
        objections: result.objections.length,
        buying_signals: result.buying_signals.length,
        risks: result.risk_indicators.length,
      },
    });

    return { ...result, source };
  }

  private async resolveText(
    tenantId: string,
    dto: AnalyzeConversationDto,
  ): Promise<{ text: string; source: string }> {
    if (dto.text) return { text: dto.text, source: 'text' };
    if (dto.call_id) {
      const call = await this.repo.getCall(tenantId, dto.call_id);
      if (!call) throw new NotFoundException('Call not found');
      const text =
        call.transcript ??
        call.transcripts.map((t) => `${t.speaker}: ${t.content}`).join('\n');
      return { text, source: 'call' };
    }
    if (dto.ai_conversation_id) {
      const conv = await this.repo.getAiConversation(tenantId, dto.ai_conversation_id);
      if (!conv) throw new NotFoundException('Conversation not found');
      const text = conv.messages.map((m) => `${m.role}: ${m.content}`).join('\n');
      return { text, source: 'ai_conversation' };
    }
    throw new BadRequestException('Provide text, call_id, or ai_conversation_id');
  }
}
