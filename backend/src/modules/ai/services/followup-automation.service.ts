import { Injectable, NotFoundException } from '@nestjs/common';

import type { AuthUser } from '../../../common/context/auth-user';
import { AuditService, type AuditRequestMeta } from '../../audit/audit.service';
import { AiRepository } from '../ai.repository';
import { GenerateFollowupsDto, ListFollowupsQueryDto } from '../dto/followup.dto';

const STALE_DAYS = Number(process.env.AI_STALE_INQUIRY_DAYS ?? 5);

@Injectable()
export class FollowupAutomationService {
  constructor(
    private readonly repo: AiRepository,
    private readonly audit: AuditService,
  ) {}

  /**
   * Generate follow-up suggestions. For a specific inquiry it proposes the next
   * touch; otherwise it scans stale open inquiries for re-engagement / missed
   * follow-ups. Suggestions are advisory — an agent accepts/applies them.
   */
  async generate(tenantId: string, dto: GenerateFollowupsDto, user: AuthUser, meta?: AuditRequestMeta) {
    const created: Array<{ id: string; type: string; title: string }> = [];

    if (dto.inquiry_id) {
      const inquiry = await this.repo.findInquiryBasic(tenantId, dto.inquiry_id);
      if (!inquiry) throw new NotFoundException('Inquiry not found');
      const row = await this.repo.createFollowupSuggestion({
        tenant_id: tenantId,
        inquiry_id: inquiry.id,
        call_id: dto.call_id ?? null,
        type: 'call_reminder',
        channel: 'call',
        title: `Follow up with ${inquiry.client_name}`,
        message: `Call ${inquiry.client_name} to advance the inquiry from stage ${inquiry.stage}. Confirm budget and preferred location.`,
        priority: 'medium',
        reasoning: 'Requested follow-up generation for a specific inquiry.',
        due_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        created_by: user.userId,
      });
      created.push({ id: row.id, type: row.type, title: row.title });
    } else {
      const staleBefore = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
      const stale = await this.repo.findStaleOpenInquiries(tenantId, staleBefore, 25);
      for (const inquiry of stale) {
        const type = inquiry.stage === 'NEW' ? 'missed_inquiry' : 're_engagement';
        const row = await this.repo.createFollowupSuggestion({
          tenant_id: tenantId,
          inquiry_id: inquiry.id,
          type,
          channel: 'whatsapp',
          title:
            type === 'missed_inquiry'
              ? `Untouched lead: ${inquiry.client_name}`
              : `Re-engage ${inquiry.client_name}`,
          message:
            type === 'missed_inquiry'
              ? `${inquiry.client_name} has had no contact since creation. Reach out today.`
              : `${inquiry.client_name} has gone quiet at stage ${inquiry.stage}. Send fresh matching options.`,
          priority: type === 'missed_inquiry' ? 'high' : 'medium',
          reasoning: `No activity since ${inquiry.updated_at.toISOString().slice(0, 10)} (> ${STALE_DAYS} days).`,
          due_at: new Date(Date.now() + 4 * 60 * 60 * 1000),
          created_by: user.userId,
        });
        created.push({ id: row.id, type: row.type, title: row.title });
      }
    }

    await this.audit.record({
      actor: user,
      tenantId,
      action: 'ai.followups.generated',
      entityType: 'ai_followup_suggestion',
      afterState: { count: created.length },
      meta,
    });
    return { generated: created.length, suggestions: created };
  }

  async list(tenantId: string, query: ListFollowupsQueryDto) {
    const page = query.page ?? 1;
    const perPage = query.per_page ?? 20;
    const { rows, total } = await this.repo.listFollowupSuggestions(tenantId, {
      status: query.status,
      inquiryId: query.inquiry_id,
      page,
      perPage,
    });
    return {
      data: rows.map((r) => ({
        id: r.id,
        inquiry_id: r.inquiry_id,
        call_id: r.call_id,
        type: r.type,
        channel: r.channel,
        title: r.title,
        message: r.message,
        priority: r.priority,
        status: r.status,
        reasoning: r.reasoning,
        due_at: r.due_at ? r.due_at.toISOString() : null,
        created_at: r.created_at.toISOString(),
      })),
      meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) || 1 },
    };
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: string,
    user: AuthUser,
    meta?: AuditRequestMeta,
  ) {
    const existing = await this.repo.getFollowupSuggestion(tenantId, id);
    if (!existing) throw new NotFoundException('Follow-up suggestion not found');
    const updated = await this.repo.updateFollowupSuggestion(tenantId, id, { status });
    await this.audit.record({
      actor: user,
      tenantId,
      action: 'ai.followup.status_changed',
      entityType: 'ai_followup_suggestion',
      entityId: id,
      beforeState: { status: existing.status },
      afterState: { status },
      meta,
    });
    return {
      id: updated!.id,
      status: updated!.status,
    };
  }
}
