import { Injectable } from '@nestjs/common';

import { AiRepository } from '../ai.repository';

const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

@Injectable()
export class AiAnalyticsService {
  constructor(private readonly repo: AiRepository) {}

  async dashboard(tenantId: string, range = '30d') {
    const days = RANGE_DAYS[range] ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const snap = await this.repo.analyticsSnapshot(tenantId, since);

    const aiConversations = snap.conversationsTotal;
    const aiConversions = snap.convertedConversations;
    const qualificationRate = snap.callsTotal
      ? Number(((snap.qualifiedCalls / snap.callsTotal) * 100).toFixed(1))
      : 0;
    const conversionRate = aiConversations
      ? Number(((aiConversions / aiConversations) * 100).toFixed(1))
      : 0;
    const handoffRate = aiConversations
      ? Number(((snap.handoffs / aiConversations) * 100).toFixed(1))
      : 0;
    // Cost per (qualified) lead — qualified calls + AI conversions are leads.
    const leads = snap.qualifiedCalls + aiConversions;
    const costPerLead = leads ? Number((snap.costUsd / leads).toFixed(4)) : 0;

    return {
      range,
      ai_conversations: aiConversations,
      ai_conversions: aiConversions,
      calls_total: snap.callsTotal,
      calls_completed: snap.callsCompleted,
      qualified_calls: snap.qualifiedCalls,
      qualification_rate: qualificationRate,
      conversion_rate: conversionRate,
      handoff_rate: handoffRate,
      knowledge_documents: snap.knowledgeCount,
      total_tokens: snap.totalTokens,
      estimated_cost_usd: Number(snap.costUsd.toFixed(4)),
      cost_per_lead_usd: costPerLead,
      temperature_breakdown: snap.temperatureBreakdown,
    };
  }
}
