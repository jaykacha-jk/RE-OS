import { Injectable } from '@nestjs/common';

import type { AuthUser } from '../../../common/context/auth-user';
import type { AuditRequestMeta } from '../../audit/audit.service';
import { CrmService } from '../../crm/crm.service';
import { AI_FEATURES, MIN_EXTRACTION_CONFIDENCE } from '../ai.constants';
import { QualifyTextDto } from '../dto/qualify.dto';
import {
  qualify,
  type EngagementSignals,
  type QualificationResult,
} from '../engines/qualification.engine';
import { AiSettingsService } from './ai-settings.service';
import { AiUsageService } from './ai-usage.service';

export interface QualificationResponse extends QualificationResult {
  applied: boolean;
  applied_reason: string;
}

@Injectable()
export class LeadQualificationService {
  constructor(
    private readonly settings: AiSettingsService,
    private readonly usage: AiUsageService,
    private readonly crm: CrmService,
  ) {}

  /** Qualify free-form conversation text into structured requirements + score. */
  async qualifyText(
    tenantId: string,
    dto: QualifyTextDto,
    user: AuthUser,
    meta?: AuditRequestMeta,
  ): Promise<QualificationResponse> {
    const engagement: EngagementSignals = {
      responses: dto.responses,
      durationSeconds: dto.duration_seconds,
    };
    const result = qualify(dto.text, engagement);
    const resolved = await this.settings.resolve(tenantId);

    await this.usage.record({
      tenantId,
      feature: AI_FEATURES.QUALIFICATION,
      provider: resolved.provider,
      outcome: result.temperature === 'hot' ? 'qualified' : 'success',
      entityType: dto.inquiry_id ? 'inquiry' : null,
      entityId: dto.inquiry_id ?? null,
      metadata: { score: result.score, temperature: result.temperature },
    });

    // BR-AI04: only auto-apply to CRM at/above the confidence threshold.
    let applied = false;
    let applied_reason = 'not_requested';
    if (dto.apply && dto.inquiry_id) {
      if (result.extracted.confidence >= MIN_EXTRACTION_CONFIDENCE) {
        await this.crm.applyAiQualification(
          tenantId,
          dto.inquiry_id,
          {
            leadScore: result.score,
            temperature: result.temperature,
            summary: this.summarize(result),
            extracted: result.extracted as unknown as Record<string, unknown>,
          },
          user,
          meta,
        );
        applied = true;
        applied_reason = 'applied';
      } else {
        applied_reason = `confidence_below_threshold (${result.extracted.confidence} < ${MIN_EXTRACTION_CONFIDENCE})`;
      }
    }

    return { ...result, applied, applied_reason };
  }

  private summarize(result: QualificationResult): string {
    const e = result.extracted;
    const parts: string[] = [];
    if (e.requirement_type) parts.push(`wants to ${e.requirement_type}`);
    if (e.bedrooms) parts.push(`${e.bedrooms} BHK`);
    if (e.property_type) parts.push(e.property_type);
    if (e.city || e.area) parts.push(`in ${[e.area, e.city].filter(Boolean).join(', ')}`);
    if (e.budget_max) parts.push(`budget up to ₹${(e.budget_max / 100000).toFixed(1)}L`);
    if (e.timeline) parts.push(`timeline ${e.timeline.replace(/_/g, ' ')}`);
    const desc = parts.length ? parts.join(', ') : 'requirements captured';
    return `AI qualification: ${desc}. Score ${result.score}/100 (${result.temperature}).`;
  }
}
