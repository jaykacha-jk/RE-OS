import { Injectable, NotFoundException } from '@nestjs/common';

import type { AuthUser } from '../../../common/context/auth-user';
import { AuditService, type AuditRequestMeta } from '../../audit/audit.service';
import { AI_FEATURES } from '../ai.constants';
import { AiRepository } from '../ai.repository';
import { CreateKnowledgeDto, ListKnowledgeQueryDto, UpdateKnowledgeDto } from '../dto/knowledge.dto';
import { rankByEmbedding } from '../engines/vector.util';
import { AiProviderFactory } from '../providers/ai-provider.factory';
import { AiSettingsService } from './ai-settings.service';
import { AiUsageService } from './ai-usage.service';

export interface RetrievedChunk {
  id: string;
  type: string;
  title: string;
  content: string;
  score: number;
}

@Injectable()
export class KnowledgeBaseService {
  constructor(
    private readonly repo: AiRepository,
    private readonly factory: AiProviderFactory,
    private readonly settings: AiSettingsService,
    private readonly usage: AiUsageService,
    private readonly audit: AuditService,
  ) {}

  private mapDoc(d: {
    id: string;
    type: string;
    title: string;
    content: string;
    source_type: string | null;
    source_id: string | null;
    embedding_model: string | null;
    is_active: boolean;
    tokens: number;
    created_at: Date;
    updated_at: Date;
  }) {
    return {
      id: d.id,
      type: d.type,
      title: d.title,
      content: d.content,
      source_type: d.source_type,
      source_id: d.source_id,
      embedding_model: d.embedding_model,
      is_active: d.is_active,
      tokens: d.tokens,
      created_at: d.created_at.toISOString(),
      updated_at: d.updated_at.toISOString(),
    };
  }

  private async embed(tenantId: string, text: string) {
    const resolved = await this.settings.resolve(tenantId);
    const bundle = this.factory.bundle(resolved.provider);
    const result = await bundle.embedding.embed(text);
    await this.usage.record({
      tenantId,
      feature: AI_FEATURES.EMBEDDING,
      provider: bundle.embedding.name,
      model: result.model,
      usage: { promptTokens: result.tokens, completionTokens: 0, totalTokens: result.tokens },
    });
    return result;
  }

  async create(tenantId: string, dto: CreateKnowledgeDto, user: AuthUser, meta?: AuditRequestMeta) {
    const embedText = `${dto.title}\n${dto.content}`;
    const embedding = await this.embed(tenantId, embedText);
    const doc = await this.repo.createKnowledge({
      tenant_id: tenantId,
      type: dto.type ?? 'document',
      title: dto.title,
      content: dto.content,
      source_type: dto.source_type ?? 'manual',
      source_id: dto.source_id ?? null,
      embedding: embedding.embedding as object,
      embedding_model: `${embedding.provider}:${embedding.model}`,
      tokens: embedding.tokens,
      created_by: user.userId,
    });
    await this.audit.record({
      actor: user,
      tenantId,
      action: 'ai.knowledge.created',
      entityType: 'ai_knowledge_document',
      entityId: doc.id,
      afterState: { title: doc.title, type: doc.type },
      meta,
    });
    return this.mapDoc(doc);
  }

  async list(tenantId: string, query: ListKnowledgeQueryDto) {
    const page = query.page ?? 1;
    const perPage = query.per_page ?? 20;
    const { rows, total } = await this.repo.listKnowledge(tenantId, {
      type: query.type,
      search: query.search,
      page,
      perPage,
    });
    return {
      data: rows.map((r) => this.mapDoc(r)),
      meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) || 1 },
    };
  }

  async getOne(tenantId: string, id: string) {
    const doc = await this.repo.getKnowledge(tenantId, id);
    if (!doc) throw new NotFoundException('Knowledge document not found');
    return this.mapDoc(doc);
  }

  async update(tenantId: string, id: string, dto: UpdateKnowledgeDto, user: AuthUser, meta?: AuditRequestMeta) {
    const existing = await this.repo.getKnowledge(tenantId, id);
    if (!existing) throw new NotFoundException('Knowledge document not found');

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.is_active !== undefined) data.is_active = dto.is_active;

    // Re-embed when text changed.
    if (dto.title !== undefined || dto.content !== undefined) {
      const embedding = await this.embed(
        tenantId,
        `${dto.title ?? existing.title}\n${dto.content ?? existing.content}`,
      );
      data.embedding = embedding.embedding as object;
      data.embedding_model = `${embedding.provider}:${embedding.model}`;
      data.tokens = embedding.tokens;
    }

    const updated = await this.repo.updateKnowledge(tenantId, id, data);
    await this.audit.record({
      actor: user,
      tenantId,
      action: 'ai.knowledge.updated',
      entityType: 'ai_knowledge_document',
      entityId: id,
      meta,
    });
    return this.mapDoc(updated!);
  }

  async remove(tenantId: string, id: string, user: AuthUser, meta?: AuditRequestMeta) {
    const existing = await this.repo.getKnowledge(tenantId, id);
    if (!existing) throw new NotFoundException('Knowledge document not found');
    await this.repo.softDeleteKnowledge(tenantId, id);
    await this.audit.record({
      actor: user,
      tenantId,
      action: 'ai.knowledge.deleted',
      entityType: 'ai_knowledge_document',
      entityId: id,
      meta,
    });
    return { id, deleted: true };
  }

  /**
   * Semantic retrieval (RAG). Embeds the query and ranks active documents by
   * cosine similarity. Only documents embedded with the same dimensionality are
   * comparable, so retrieval stays correct across provider switches.
   */
  async search(tenantId: string, query: string, type?: string, limit = 5): Promise<RetrievedChunk[]> {
    const embedding = await this.embed(tenantId, query);
    const docs = await this.repo.listActiveKnowledge(tenantId, type);
    const ranked = rankByEmbedding(
      embedding.embedding,
      docs.map((d) => ({ ...d, embedding: (d.embedding as number[]) ?? [] })),
      limit,
    );
    return ranked.map((r) => ({
      id: r.document.id,
      type: r.document.type,
      title: r.document.title,
      content: r.document.content,
      score: Number(r.score.toFixed(4)),
    }));
  }
}
