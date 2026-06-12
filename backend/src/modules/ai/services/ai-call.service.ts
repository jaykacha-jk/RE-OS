import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import type { AuthUser } from '../../../common/context/auth-user';
import { AuditService, type AuditRequestMeta } from '../../audit/audit.service';
import { CrmService } from '../../crm/crm.service';
import { AI_FEATURES, AI_FULL_ACCESS_ROLES, MIN_EXTRACTION_CONFIDENCE } from '../ai.constants';
import { AiRepository, type AiScope } from '../ai.repository';
import { CreateAgentDto, UpdateAgentDto } from '../dto/ai-agent.dto';
import { CallWebhookDto, CreateCallDto } from '../dto/ai-call.dto';
import { analyzeConversation } from '../engines/intelligence.engine';
import { qualify } from '../engines/qualification.engine';
import { AiProviderFactory } from '../providers/ai-provider.factory';
import { AiSettingsService } from './ai-settings.service';
import { AiUsageService } from './ai-usage.service';

@Injectable()
export class AiCallService {
  private readonly logger = new Logger(AiCallService.name);

  constructor(
    private readonly repo: AiRepository,
    private readonly factory: AiProviderFactory,
    private readonly settings: AiSettingsService,
    private readonly usage: AiUsageService,
    private readonly crm: CrmService,
    private readonly audit: AuditService,
  ) {}

  private resolveScope(user: AuthUser): AiScope {
    const isFull =
      user.roles?.some((r) => AI_FULL_ACCESS_ROLES.includes(r)) || user.tenantId == null;
    return isFull ? { type: 'all' } : { type: 'own', userId: user.userId };
  }

  // --- Voice agents ----------------------------------------------------------

  async listAgents(tenantId: string) {
    const rows = await this.repo.listAgents(tenantId);
    return rows.map((a) => this.mapAgent(a));
  }

  async createAgent(tenantId: string, dto: CreateAgentDto, user: AuthUser, meta?: AuditRequestMeta) {
    const agent = await this.repo.createAgent({
      tenant_id: tenantId,
      name: dto.name,
      type: dto.type ?? 'voice',
      phone_number: dto.phone_number ?? null,
      call_provider: dto.call_provider ?? process.env.VOICE_PROVIDER ?? 'mock',
      configuration: (dto.configuration ?? {}) as object,
      created_by: user.userId,
    });
    await this.audit.record({
      actor: user,
      tenantId,
      action: 'ai.agent.created',
      entityType: 'ai_agent',
      entityId: agent.id,
      afterState: { name: agent.name, type: agent.type },
      meta,
    });
    return this.mapAgent(agent);
  }

  async updateAgent(tenantId: string, id: string, dto: UpdateAgentDto, user: AuthUser, meta?: AuditRequestMeta) {
    const existing = await this.repo.getAgent(tenantId, id);
    if (!existing) throw new NotFoundException('AI agent not found');
    const updated = await this.repo.updateAgent(tenantId, id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.phone_number !== undefined ? { phone_number: dto.phone_number } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.call_provider !== undefined ? { call_provider: dto.call_provider } : {}),
      ...(dto.configuration !== undefined ? { configuration: dto.configuration as object } : {}),
    });
    await this.audit.record({
      actor: user,
      tenantId,
      action: 'ai.agent.updated',
      entityType: 'ai_agent',
      entityId: id,
      meta,
    });
    return this.mapAgent(updated!);
  }

  async removeAgent(tenantId: string, id: string, user: AuthUser, meta?: AuditRequestMeta) {
    const existing = await this.repo.getAgent(tenantId, id);
    if (!existing) throw new NotFoundException('AI agent not found');
    await this.repo.softDeleteAgent(tenantId, id);
    await this.audit.record({
      actor: user,
      tenantId,
      action: 'ai.agent.deleted',
      entityType: 'ai_agent',
      entityId: id,
      meta,
    });
    return { id, deleted: true };
  }

  // --- Calls -----------------------------------------------------------------

  async listCalls(
    tenantId: string,
    user: AuthUser,
    filters: { status?: string; direction?: string; search?: string; page?: number; per_page?: number },
  ) {
    const page = filters.page ?? 1;
    const perPage = filters.per_page ?? 20;
    const { rows, total } = await this.repo.listCalls(tenantId, this.resolveScope(user), {
      status: filters.status,
      direction: filters.direction,
      search: filters.search,
      page,
      perPage,
    });
    return {
      data: rows.map((c) => this.mapCallSummary(c)),
      meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) || 1 },
    };
  }

  async getCall(tenantId: string, id: string) {
    const call = await this.repo.getCall(tenantId, id);
    if (!call) throw new NotFoundException('Call not found');
    return this.mapCallDetail(call);
  }

  async getTranscript(tenantId: string, id: string) {
    const call = await this.repo.getCall(tenantId, id);
    if (!call) throw new NotFoundException('Call not found');
    return {
      call_id: call.id,
      transcript: call.transcript,
      segments: call.transcripts.map((t) => ({
        speaker: t.speaker,
        content: t.content,
        sentiment: t.sentiment,
        offset_ms: t.offset_ms,
      })),
    };
  }

  /** Initiate an (outbound by default) AI call. */
  async initiateCall(tenantId: string, dto: CreateCallDto, user: AuthUser, meta?: AuditRequestMeta) {
    const direction = dto.direction ?? 'outbound';
    // India compliance: outbound recording requires disclosed consent (BR-AI06).
    if (direction === 'outbound' && dto.consent_recorded === false) {
      throw new BadRequestException({
        code: 'CONSENT_REQUIRED',
        rule_id: 'BR-AI06',
        message: 'Outbound recorded calls require consent_recorded = true (India compliance).',
      });
    }

    const resolved = await this.settings.resolve(tenantId);
    if (!resolved.voice_enabled) {
      throw new BadRequestException('Voice agent is disabled for this tenant');
    }
    const bundle = this.factory.bundle(resolved.provider);

    const agent = dto.agent_id ? await this.repo.getAgent(tenantId, dto.agent_id) : null;

    const call = await this.repo.createCall({
      tenant_id: tenantId,
      agent_id: agent?.id ?? null,
      inquiry_id: dto.inquiry_id ?? null,
      client_phone: dto.client_phone,
      client_name: dto.client_name ?? null,
      direction,
      status: 'queued',
      provider: bundle.voice.name,
      consent_recorded: dto.consent_recorded ?? false,
      created_by: user.userId,
    });

    let placed;
    try {
      placed = await bundle.voice.placeCall({
        tenantId,
        toPhone: dto.client_phone,
        fromPhone: agent?.phone_number ?? null,
        agentName: agent?.name,
        direction: direction as 'inbound' | 'outbound',
      });
    } catch (err) {
      await this.repo.updateCall(tenantId, call.id, {
        status: 'failed',
        error: err instanceof Error ? err.message : 'placeCall failed',
      });
      throw new BadRequestException('Failed to place call via telephony provider');
    }

    await this.repo.updateCall(tenantId, call.id, {
      call_sid: placed.callSid,
      status: 'in_progress',
      recording_url: placed.recordingUrl ?? null,
      started_at: new Date(),
    });

    await this.audit.record({
      actor: user,
      tenantId,
      action: 'ai.call.initiated',
      entityType: 'ai_call',
      entityId: call.id,
      afterState: { client_phone: dto.client_phone, direction, provider: bundle.voice.name },
      meta,
    });

    // Mock telephony returns a recording immediately; run the post-call pipeline
    // synchronously so the demo flow works end-to-end. Real providers call back
    // via the webhook, which triggers the same pipeline.
    const shouldSimulate = dto.simulate ?? bundle.voice.name === 'mock';
    if (shouldSimulate && placed.recordingUrl) {
      await this.runPostCallPipeline(tenantId, call.id, placed.recordingUrl, resolved.provider);
    }

    return this.getCall(tenantId, call.id);
  }

  /** Provider webhook ingest (status updates + recording-ready → pipeline). */
  async handleWebhook(dto: CallWebhookDto, signature: string | undefined) {
    const bundle = this.factory.bundle(process.env.AI_PROVIDER ?? 'mock');
    if (!bundle.voice.verifyWebhookSignature(JSON.stringify(dto), signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }
    const updated = await this.repo.updateCallBySid(dto.call_sid, {
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.recording_url ? { recording_url: dto.recording_url } : {}),
      ...(dto.duration_seconds ? { duration_seconds: dto.duration_seconds } : {}),
    });
    if (!updated) return { ok: true, matched: false };

    if ((dto.status === 'completed' || dto.recording_url) && updated.recording_url) {
      const resolved = await this.settings.resolve(updated.tenant_id);
      await this.runPostCallPipeline(updated.tenant_id, updated.id, updated.recording_url, resolved.provider);
    }
    return { ok: true, matched: true };
  }

  /**
   * Post-call AI pipeline (AI_AGENT_SPEC §2): transcribe → analyze → qualify →
   * update the call record, meter AI minutes, and (BR-AI04) push qualification
   * into the linked CRM inquiry when confidence clears the threshold.
   */
  async runPostCallPipeline(
    tenantId: string,
    callId: string,
    recordingUrl: string,
    providerPref: string,
  ) {
    const bundle = this.factory.bundle(providerPref);
    const start = Date.now();
    try {
      const transcription = await bundle.transcription.transcribe({
        recordingUrl,
        seed: callId,
      });

      await this.repo.addTranscriptSegments(
        transcription.segments.map((s) => ({
          tenant_id: tenantId,
          call_id: callId,
          speaker: s.speaker,
          content: s.content,
          sentiment: s.sentiment ?? null,
          offset_ms: s.offsetMs,
        })),
      );

      const clientText = transcription.segments
        .filter((s) => s.speaker === 'client')
        .map((s) => s.content)
        .join(' ');
      const responses = transcription.segments.filter((s) => s.speaker === 'client').length;

      const qualification = qualify(clientText || transcription.transcript, {
        responses,
        durationSeconds: transcription.durationSeconds,
      });
      const intelligence = analyzeConversation(transcription.transcript);

      const durationSeconds = transcription.durationSeconds;
      await this.repo.updateCall(tenantId, callId, {
        status: 'completed',
        duration_seconds: durationSeconds,
        transcript: transcription.transcript,
        summary: intelligence.summary,
        sentiment: intelligence.sentiment,
        qualification_score: qualification.score,
        temperature: qualification.temperature,
        extracted: qualification.extracted as object,
        next_action: intelligence.recommended_actions[0] ?? null,
        ended_at: new Date(),
      });

      await this.repo.incrementAiMinutes(tenantId, durationSeconds / 60);

      await this.usage.record({
        tenantId,
        feature: AI_FEATURES.CALL,
        provider: bundle.transcription.name,
        durationMs: Date.now() - start,
        entityType: 'ai_call',
        entityId: callId,
        outcome: qualification.temperature === 'hot' ? 'qualified' : 'success',
        metadata: { score: qualification.score, sentiment: intelligence.sentiment },
      });

      // Push insights to CRM (AI enhances CRM, never replaces it).
      const call = await this.repo.getCall(tenantId, callId);
      const resolved = await this.settings.resolve(tenantId);
      if (
        call?.inquiry_id &&
        resolved.auto_qualify &&
        qualification.extracted.confidence >= MIN_EXTRACTION_CONFIDENCE
      ) {
        await this.crm.applyAiQualification(
          tenantId,
          call.inquiry_id,
          {
            leadScore: qualification.score,
            temperature: qualification.temperature,
            summary: `AI call summary: ${intelligence.summary}`,
            extracted: qualification.extracted as unknown as Record<string, unknown>,
          },
          null,
        );
      }

      // Suggest a follow-up from the call's recommended next action.
      if (resolved.auto_followups && intelligence.recommended_actions.length) {
        await this.repo.createFollowupSuggestion({
          tenant_id: tenantId,
          inquiry_id: call?.inquiry_id ?? null,
          call_id: callId,
          type: 'call_reminder',
          channel: 'call',
          title: 'Post-call follow-up',
          message: intelligence.recommended_actions[0],
          priority: qualification.temperature === 'hot' ? 'high' : 'medium',
          reasoning: `Generated from AI call analysis (sentiment: ${intelligence.sentiment}).`,
          due_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
      }
    } catch (err) {
      this.logger.error(`Post-call pipeline failed for ${callId}: ${err instanceof Error ? err.message : err}`);
      await this.repo.updateCall(tenantId, callId, {
        status: 'completed',
        error: 'post_call_pipeline_failed',
      });
    }
  }

  // --- mappers ---------------------------------------------------------------

  private mapAgent(a: {
    id: string;
    name: string;
    type: string;
    phone_number: string | null;
    call_provider: string;
    status: string;
    configuration: unknown;
    created_at: Date;
  }) {
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      phone_number: a.phone_number,
      call_provider: a.call_provider,
      status: a.status,
      configuration: a.configuration,
      created_at: a.created_at.toISOString(),
    };
  }

  private mapCallSummary(c: {
    id: string;
    client_phone: string;
    client_name: string | null;
    direction: string;
    status: string;
    duration_seconds: number;
    sentiment: string | null;
    qualification_score: number | null;
    temperature: string | null;
    created_at: Date;
    agent?: { id: string; name: string } | null;
  }) {
    return {
      id: c.id,
      client_phone: c.client_phone,
      client_name: c.client_name,
      direction: c.direction,
      status: c.status,
      duration_seconds: c.duration_seconds,
      sentiment: c.sentiment,
      qualification_score: c.qualification_score,
      temperature: c.temperature,
      agent: c.agent ? { id: c.agent.id, name: c.agent.name } : null,
      created_at: c.created_at.toISOString(),
    };
  }

  private mapCallDetail(c: {
    id: string;
    tenant_id: string;
    agent_id: string | null;
    inquiry_id: string | null;
    call_sid: string | null;
    client_phone: string;
    client_name: string | null;
    direction: string;
    status: string;
    provider: string;
    duration_seconds: number;
    recording_url: string | null;
    transcript: string | null;
    summary: string | null;
    sentiment: string | null;
    qualification_score: number | null;
    temperature: string | null;
    extracted: unknown;
    next_action: string | null;
    consent_recorded: boolean;
    created_at: Date;
    transcripts: Array<{ speaker: string; content: string; sentiment: string | null; offset_ms: number }>;
  }) {
    return {
      id: c.id,
      agent_id: c.agent_id,
      inquiry_id: c.inquiry_id,
      call_sid: c.call_sid,
      client_phone: c.client_phone,
      client_name: c.client_name,
      direction: c.direction,
      status: c.status,
      provider: c.provider,
      duration_seconds: c.duration_seconds,
      recording_url: c.recording_url,
      transcript: c.transcript,
      summary: c.summary,
      sentiment: c.sentiment,
      qualification_score: c.qualification_score,
      temperature: c.temperature,
      extracted: c.extracted,
      next_action: c.next_action,
      consent_recorded: c.consent_recorded,
      created_at: c.created_at.toISOString(),
      segments: c.transcripts.map((t) => ({
        speaker: t.speaker,
        content: t.content,
        sentiment: t.sentiment,
        offset_ms: t.offset_ms,
      })),
    };
  }
}
