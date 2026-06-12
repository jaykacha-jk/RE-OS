import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { AuthUser } from '../../common/context/auth-user';
import { AuditService, type AuditRequestMeta } from '../audit/audit.service';
import { NotificationsRepository } from './notifications.repository';
import { SYSTEM_TEMPLATES } from './notifications.constants';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

type TemplateRow = {
  id: string;
  tenant_id: string | null;
  key: string;
  channel: string;
  type: string;
  priority: string;
  title_template: string;
  body_template: string;
  email_subject_template: string | null;
  is_active: boolean;
  is_system: boolean;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class NotificationTemplatesService {
  constructor(
    private readonly repo: NotificationsRepository,
    private readonly auditService: AuditService,
  ) {}

  private map(t: TemplateRow) {
    return {
      id: t.id,
      tenant_id: t.tenant_id,
      key: t.key,
      channel: t.channel,
      type: t.type,
      priority: t.priority,
      title_template: t.title_template,
      body_template: t.body_template,
      email_subject_template: t.email_subject_template,
      is_active: t.is_active,
      is_system: t.is_system,
      created_at: t.created_at.toISOString(),
      updated_at: t.updated_at.toISOString(),
    };
  }

  /** List tenant templates plus the read-only system defaults for reference. */
  async list(tenantId: string | null) {
    const rows = await this.repo.listTemplates(tenantId, true);
    const custom = rows.map((r) => this.map(r as TemplateRow));

    const systemDefaults = Object.entries(SYSTEM_TEMPLATES).map(([key, t]) => ({
      key,
      channel: 'in_app',
      type: t.type,
      priority: t.priority,
      title_template: t.title,
      body_template: t.body,
      email_subject_template: t.emailSubject,
      is_system_default: true,
    }));

    return { templates: custom, system_defaults: systemDefaults };
  }

  async create(
    tenantId: string | null,
    actor: AuthUser,
    dto: CreateTemplateDto,
    meta?: AuditRequestMeta,
  ) {
    const existing = await this.repo.findActiveTemplate(tenantId, dto.key, dto.channel);
    if (existing && existing.tenant_id === tenantId) {
      throw new ConflictException(
        `A template for key "${dto.key}" / channel "${dto.channel}" already exists`,
      );
    }

    const created = await this.repo.createTemplate({
      tenant_id: tenantId,
      key: dto.key,
      channel: dto.channel,
      type: dto.type,
      priority: dto.priority ?? 'MEDIUM',
      title_template: dto.title_template,
      body_template: dto.body_template,
      email_subject_template: dto.email_subject_template ?? null,
      is_active: dto.is_active ?? true,
      is_system: false,
      created_by: actor.userId,
    });

    await this.auditService.record({
      actor,
      tenantId,
      action: 'notifications.template.created',
      entityType: 'notification_template',
      entityId: created.id,
      afterState: { key: dto.key, channel: dto.channel },
      meta,
    });

    return this.map(created as TemplateRow);
  }

  async update(
    tenantId: string | null,
    actor: AuthUser,
    id: string,
    dto: UpdateTemplateDto,
    meta?: AuditRequestMeta,
  ) {
    const existing = await this.repo.findTemplateById(id, tenantId);
    if (!existing) throw new NotFoundException('Template not found');

    const updated = await this.repo.updateTemplate(id, {
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      ...(dto.title_template !== undefined ? { title_template: dto.title_template } : {}),
      ...(dto.body_template !== undefined ? { body_template: dto.body_template } : {}),
      ...(dto.email_subject_template !== undefined
        ? { email_subject_template: dto.email_subject_template ?? null }
        : {}),
      ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
    });

    await this.auditService.record({
      actor,
      tenantId,
      action: 'notifications.template.updated',
      entityType: 'notification_template',
      entityId: id,
      meta,
    });

    return this.map(updated as TemplateRow);
  }
}
