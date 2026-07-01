import { Injectable } from '@nestjs/common';

import { paginationMeta, resolvePagination } from '../../../common/pagination';

import type { AuthUser } from '../../../common/context/auth-user';
import { AuditService, type AuditRequestMeta } from '../../audit/audit.service';
import { AiRepository } from '../ai.repository';
import { UpsertPromptDto } from '../dto/prompt.dto';

@Injectable()
export class PromptService {
  constructor(
    private readonly repo: AiRepository,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, page?: number, perPage?: number) {
    const pagination = resolvePagination(page, perPage);
    const { rows, total } = await this.repo.listPrompts(tenantId, pagination);
    const data = rows.map((p) => ({
      id: p.id,
      tenant_id: p.tenant_id,
      key: p.key,
      name: p.name,
      description: p.description,
      system_prompt: p.system_prompt,
      user_prompt_template: p.user_prompt_template,
      model: p.model,
      temperature: p.temperature != null ? Number(p.temperature) : null,
      is_active: p.is_active,
      is_system: p.is_system,
      scope: p.tenant_id ? 'tenant' : 'system',
    }));
    if (!pagination || total === null) return { data };
    return { data, pagination: paginationMeta(pagination.page, pagination.perPage, total) };
  }

  /** Resolve the system prompt text for a key (tenant override → system → fallback). */
  async resolveSystemPrompt(tenantId: string, key: string, fallback: string): Promise<string> {
    const row = await this.repo.resolvePrompt(tenantId, key);
    return row?.system_prompt ?? fallback;
  }

  async upsert(tenantId: string, dto: UpsertPromptDto, user: AuthUser, meta?: AuditRequestMeta) {
    const saved = await this.repo.upsertPrompt(tenantId, dto.key, {
      tenant_id: tenantId,
      key: dto.key,
      name: dto.name,
      description: dto.description ?? null,
      system_prompt: dto.system_prompt,
      user_prompt_template: dto.user_prompt_template ?? null,
      model: dto.model ?? null,
      temperature: dto.temperature != null ? dto.temperature.toFixed(2) : null,
      is_active: dto.is_active ?? true,
      is_system: false,
      created_by: user.userId,
    });

    await this.audit.record({
      actor: user,
      tenantId,
      action: 'ai.prompt.upserted',
      entityType: 'ai_prompt_template',
      entityId: saved?.id,
      afterState: { key: dto.key, name: dto.name },
      meta,
    });
    return saved;
  }
}
