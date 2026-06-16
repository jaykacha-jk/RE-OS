import { Injectable, ForbiddenException } from '@nestjs/common';

import type { AuthUser } from '../../common/context/auth-user';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { AuditRepository } from './audit.repository';

export type AuditRequestMeta = {
  ipAddress?: string;
  userAgent?: string;
};

export type AuditActor = Pick<AuthUser, 'userId' | 'tenantId'>;

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  async record(input: {
    actor?: AuditActor | null;
    actorEmail?: string | null;
    tenantId?: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
    meta?: AuditRequestMeta;
  }) {
    try {
      const actorId = input.actor?.userId ?? null;
      const actorEmail =
        input.actorEmail ?? (actorId ? await this.auditRepository.findActorEmail(actorId) : null);

      await this.auditRepository.create({
        tenantId: input.tenantId ?? input.actor?.tenantId ?? null,
        actorId,
        actorEmail,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeState: input.beforeState,
        afterState: input.afterState,
        ipAddress: input.meta?.ipAddress,
        userAgent: input.meta?.userAgent,
      });
    } catch {
      // Audit failures must not block the business operation.
    }
  }

  private filtersFrom(user: AuthUser, query: ListAuditLogsQueryDto) {
    if (user.roles.includes('super_admin')) {
      return {
        tenantId: query.tenant_id,
        action: query.action,
        entityType: query.entity_type,
        actorEmail: query.actor_email,
        entityId: query.entity_id,
        dateFrom: query.date_from,
        dateTo: query.date_to,
      };
    }

    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    return {
      tenantId: user.tenantId,
      action: query.action,
      entityType: query.entity_type,
      actorEmail: query.actor_email,
      entityId: query.entity_id,
      dateFrom: query.date_from,
      dateTo: query.date_to,
    };
  }

  async list(user: AuthUser, query: ListAuditLogsQueryDto) {
    const page = query.page ?? 1;
    const perPage = query.per_page ?? 20;
    const { rows, total } = await this.auditRepository.list({
      ...this.filtersFrom(user, query),
      page,
      perPage,
    });

    return {
      data: rows.map((row) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        actor_id: row.actor_id,
        actor_email: row.actor_email,
        action: row.action,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        before_state: row.before_state,
        after_state: row.after_state,
        ip_address: row.ip_address,
        user_agent: row.user_agent,
        created_at: row.created_at.toISOString(),
      })),
      meta: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage) || 1,
      },
    };
  }

  /** Builds a CSV export of the filtered audit trail (capped at `limit` rows). */
  async exportCsv(user: AuthUser, query: ListAuditLogsQueryDto, limit = 10_000): Promise<string> {
    const rows = await this.auditRepository.listForExport({
      ...this.filtersFrom(user, query),
      limit,
    });

    const headers = [
      'id',
      'tenant_id',
      'actor_id',
      'actor_email',
      'action',
      'entity_type',
      'entity_id',
      'before_state',
      'after_state',
      'ip_address',
      'user_agent',
      'created_at',
    ];

    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(
        [
          row.id,
          row.tenant_id,
          row.actor_id,
          row.actor_email,
          row.action,
          row.entity_type,
          row.entity_id,
          row.before_state == null ? '' : JSON.stringify(row.before_state),
          row.after_state == null ? '' : JSON.stringify(row.after_state),
          row.ip_address,
          row.user_agent,
          row.created_at.toISOString(),
        ]
          .map((v) => csvCell(v))
          .join(','),
      );
    }
    return lines.join('\r\n');
  }
}

/** RFC 4180 CSV escaping — quote when the value contains , " CR or LF. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
