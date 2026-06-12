import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';

type AuditState = Record<string, unknown> | null | undefined;

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActorEmail(actorId: string) {
    const actor = await this.prisma.dbClient.users.findUnique({
      where: { id: actorId },
      select: { email: true },
    });
    return actor?.email ?? null;
  }

  async create(input: {
    tenantId?: string | null;
    actorId?: string | null;
    actorEmail?: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    beforeState?: AuditState;
    afterState?: AuditState;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    return this.prisma.dbClient.audit_logs.create({
      data: {
        tenant_id: input.tenantId ?? null,
        actor_id: input.actorId ?? null,
        actor_email: input.actorEmail ?? null,
        action: input.action,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        before_state:
          input.beforeState === undefined ? undefined : (input.beforeState as Prisma.InputJsonValue),
        after_state:
          input.afterState === undefined ? undefined : (input.afterState as Prisma.InputJsonValue),
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
      },
    });
  }

  private buildWhere(input: {
    tenantId?: string | null;
    action?: string;
    entityType?: string;
    actorEmail?: string;
    entityId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Prisma.audit_logsWhereInput {
    const createdAt: Prisma.DateTimeFilter = {};
    if (input.dateFrom) createdAt.gte = new Date(input.dateFrom);
    if (input.dateTo) createdAt.lte = new Date(input.dateTo);

    return {
      ...(input.tenantId !== undefined ? { tenant_id: input.tenantId } : {}),
      ...(input.action ? { action: input.action } : {}),
      ...(input.entityType ? { entity_type: input.entityType } : {}),
      ...(input.entityId ? { entity_id: input.entityId } : {}),
      ...(input.actorEmail
        ? { actor_email: { contains: input.actorEmail, mode: 'insensitive' } }
        : {}),
      ...(input.dateFrom || input.dateTo ? { created_at: createdAt } : {}),
    };
  }

  async list(input: {
    tenantId?: string | null;
    action?: string;
    entityType?: string;
    actorEmail?: string;
    entityId?: string;
    dateFrom?: string;
    dateTo?: string;
    page: number;
    perPage: number;
  }) {
    const where = this.buildWhere(input);

    const [rows, total] = await Promise.all([
      this.prisma.dbClient.audit_logs.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
      }),
      this.prisma.dbClient.audit_logs.count({ where }),
    ]);

    return { rows, total };
  }

  /** Bounded export — caps rows to protect memory on large tenants. */
  async listForExport(input: {
    tenantId?: string | null;
    action?: string;
    entityType?: string;
    actorEmail?: string;
    entityId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit: number;
  }) {
    const where = this.buildWhere(input);
    return this.prisma.dbClient.audit_logs.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: input.limit,
    });
  }
}
