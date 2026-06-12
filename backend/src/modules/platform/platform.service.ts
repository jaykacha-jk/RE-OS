import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

import { CreateOrganizationDto } from './dto/create-organization.dto';
import { ListOrganizationsQueryDto } from './dto/list-organizations-query.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { PlatformRepository } from './platform.repository';
import type { AuthUser } from '../../common/context/auth-user';
import { AuditService, type AuditRequestMeta } from '../audit/audit.service';

const INVITATION_TTL_DAYS = 7;

@Injectable()
export class PlatformService {
  constructor(
    private readonly platformRepository: PlatformRepository,
    private readonly auditService: AuditService,
  ) {}

  private devInvitationHint(token: string) {
    if (process.env.NODE_ENV === 'production') return {};
    const base = process.env.APP_URL ?? 'http://localhost:3000';
    return {
      invitation_token: token,
      accept_url: `${base}/accept-invitation?token=${encodeURIComponent(token)}`,
    };
  }

  private mapOrganization(org: {
    id: string;
    name: string;
    slug: string;
    status: string;
    tier: string;
    billing_email: string;
    created_at: Date;
    organization_usage?: {
      properties_count: number;
      employees_count: number;
    } | null;
  }) {
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      domain: `${org.slug}.reos.app`,
      status: org.status,
      tier: org.tier,
      billing_email: org.billing_email,
      properties_count: org.organization_usage?.properties_count ?? 0,
      employees_count: org.organization_usage?.employees_count ?? 0,
      created_at: org.created_at.toISOString(),
    };
  }

  async listOrganizations(query: ListOrganizationsQueryDto) {
    const page = query.page ?? 1;
    const perPage = query.per_page ?? 20;
    const { rows, total } = await this.platformRepository.listOrganizations({
      status: query['filter[status]'],
      tier: query['filter[tier]'],
      page,
      perPage,
    });

    return {
      data: rows.map((org) => this.mapOrganization(org)),
      meta: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage) || 1,
      },
    };
  }

  async createOrganization(dto: CreateOrganizationDto, actor?: AuthUser, meta?: AuditRequestMeta) {
    const existing = await this.platformRepository.findOrganizationBySlug(dto.slug);
    if (existing) {
      throw new ConflictException('Slug is already taken');
    }

    const org = await this.platformRepository.createOrganization({
      name: dto.name,
      slug: dto.slug,
      tier: dto.tier,
      billing_email: dto.billing_email,
    });

    const ownerRole = await this.platformRepository.findRoleByCode('org_owner');
    if (!ownerRole) {
      throw new NotFoundException('org_owner role is not seeded');
    }

    const existingOwner = await this.platformRepository.findUserByEmailInTenant(
      dto.owner_email,
      org.id,
    );
    if (existingOwner) {
      throw new ConflictException('Owner email already exists for this organization');
    }

    const invitationToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(invitationToken).digest('hex');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.platformRepository.createOwnerInvitation({
      tenantId: org.id,
      email: dto.owner_email,
      roleId: ownerRole.id,
      tokenHash,
      expiresAt,
    });

    // Email dispatch is async (BullMQ) — invitation record created; send deferred to Phase 5.
    const response = {
      organization: this.mapOrganization(org),
      invitation_sent: false,
      invitation_pending: true,
      ...this.devInvitationHint(invitationToken),
    };

    await this.auditService.record({
      actor,
      tenantId: org.id,
      action: 'platform.organization.created',
      entityType: 'organization',
      entityId: org.id,
      afterState: response.organization,
      meta,
    });

    return response;
  }

  async updateOrganization(
    id: string,
    dto: UpdateOrganizationDto,
    actor?: AuthUser,
    meta?: AuditRequestMeta,
  ) {
    const existing = await this.platformRepository.findOrganizationById(id);
    if (!existing) {
      throw new NotFoundException('Organization not found');
    }

    const updated = await this.platformRepository.updateOrganization(id, {
      status: dto.status,
      tier: dto.tier,
      billing_email: dto.billing_email,
      name: dto.name,
    });

    const mapped = this.mapOrganization(updated);
    await this.auditService.record({
      actor,
      tenantId: id,
      action: 'platform.organization.updated',
      entityType: 'organization',
      entityId: id,
      beforeState: this.mapOrganization(existing),
      afterState: mapped,
      meta,
    });

    return mapped;
  }
}
