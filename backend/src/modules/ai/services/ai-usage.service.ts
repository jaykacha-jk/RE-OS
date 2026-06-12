import { Injectable } from '@nestjs/common';

import { AiRepository } from '../ai.repository';
import type { LlmUsage } from '../providers/ai-provider.types';

/** Rough OpenAI gpt-4o-mini blended price (USD per 1K tokens) for cost hints. */
const COST_PER_1K_TOKENS_USD = Number(process.env.AI_COST_PER_1K_TOKENS_USD ?? 0.0006);

@Injectable()
export class AiUsageService {
  constructor(private readonly repo: AiRepository) {}

  /** Record an AI usage/cost event (never throws into the caller's path). */
  async record(input: {
    tenantId: string;
    feature: string;
    provider: string;
    model?: string | null;
    usage?: LlmUsage | null;
    durationMs?: number;
    entityType?: string | null;
    entityId?: string | null;
    outcome?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const total = input.usage?.totalTokens ?? 0;
      const cost = input.provider === 'mock' ? 0 : (total / 1000) * COST_PER_1K_TOKENS_USD;
      await this.repo.recordUsage({
        tenant_id: input.tenantId,
        feature: input.feature,
        provider: input.provider,
        model: input.model ?? null,
        prompt_tokens: input.usage?.promptTokens ?? 0,
        completion_tokens: input.usage?.completionTokens ?? 0,
        total_tokens: total,
        cost_usd: cost ? cost.toFixed(6) : '0',
        duration_ms: input.durationMs ?? 0,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        outcome: input.outcome ?? 'success',
        metadata: (input.metadata ?? {}) as object,
      });
    } catch {
      // Usage accounting must never break a business operation.
    }
  }
}
