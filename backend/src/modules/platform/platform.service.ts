import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

import { CreateOrganizationDto } from './dto/create-organization.dto';
import { ListOrganizationsQueryDto } from './dto/list-organizations-query.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UploadOrgLogoDto } from './dto/upload-org-logo.dto';
import { PlatformRepository } from './platform.repository';
import type { AuthUser } from '../../common/context/auth-user';
import { DomainEventBus } from '../../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../../events/domain-events';
import { AuditService, type AuditRequestMeta } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';
import {
  ALLOWED_PROPERTY_IMAGE_CONTENT_TYPES,
  PROPERTY_IMAGE_MAX_BYTES,
} from '../properties/properties.constants';
import { StorageService } from '../properties/storage/storage.service';
import { normalizeOrgTier } from './org-tier';

const INVITATION_TTL_DAYS = 7;

@Injectable()
export class PlatformService {
  constructor(
    private readonly platformRepository: PlatformRepository,
    private readonly auditService: AuditService,
    private readonly events: DomainEventBus,
    private readonly storage: StorageService,
    private readonly billing: BillingService,
  ) {}

  private devInvitationHint(token: string) {
    if (process.env.NODE_ENV === 'production') return {};
    return {
      invitation_token: token,
      accept_url: this.invitationUrl(token),
    };
  }

  private invitationUrl(token: string) {
    const base = process.env.APP_URL ?? 'http://localhost:3000';
    return `${base.replace(/\/$/, '')}/accept-invitation?token=${encodeURIComponent(token)}`;
  }

  private mapOrganization(org: {
    id: string;
    name: string;
    slug: string;
    status: string;
    tier: string;
    billing_email: string;
    logo_url?: string | null;
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
      logo_url: this.storage.resolveUrl(org.logo_url ?? null),
      properties_count: org.organization_usage?.properties_count ?? 0,
      employees_count: org.organization_usage?.employees_count ?? 0,
      created_at: org.created_at.toISOString(),
    };
  }

  private assertValidLogoUpload(contentBase64: string, contentType?: string): void {
    const bytes = this.storage.decodedByteLength(contentBase64);
    if (bytes > PROPERTY_IMAGE_MAX_BYTES) {
      throw new UnprocessableEntityException({
        code: 'IMAGE_TOO_LARGE',
        message: `Logo exceeds the ${PROPERTY_IMAGE_MAX_BYTES / (1024 * 1024)} MB limit`,
      });
    }
    if (!contentType) {
      throw new BadRequestException('content_type is required for logo uploads');
    }
    if (!(ALLOWED_PROPERTY_IMAGE_CONTENT_TYPES as readonly string[]).includes(contentType)) {
      throw new BadRequestException(`Unsupported logo type: ${contentType}`);
    }
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

  async getOrganization(id: string) {
    const org = await this.platformRepository.findOrganizationById(id);
    if (!org) throw new NotFoundException('Organization not found');
    return this.mapOrganization(org);
  }

  async createOrganization(dto: CreateOrganizationDto, actor?: AuthUser, meta?: AuditRequestMeta) {
    const existing = await this.platformRepository.findOrganizationBySlug(dto.slug);
    if (existing) {
      throw new ConflictException('Slug is already taken');
    }

    const org = await this.platformRepository.createOrganization({
      name: dto.name,
      slug: dto.slug,
      tier: normalizeOrgTier(dto.tier),
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

    const owner = await this.platformRepository.createOwnerInvitation({
      tenantId: org.id,
      email: dto.owner_email,
      roleId: ownerRole.id,
      tokenHash,
      expiresAt,
    });

    const response = {
      organization: this.mapOrganization(org),
      invitation_sent: true,
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

    if (actor) {
      await this.billing.syncOrganizationPlanFromPlatform(org.id, org.tier, actor, meta);
    }

    this.events.emit(DOMAIN_EVENTS.USER_INVITED, {
      tenantId: org.id,
      actorUserId: actor?.userId ?? null,
      entityType: 'user',
      entityId: owner.id,
      recipientUserIds: [owner.id],
      context: {
        email: dto.owner_email,
        roleCode: 'org_owner',
        organizationName: org.name,
        acceptUrl: this.invitationUrl(invitationToken),
      },
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

    const normalizedTier = dto.tier !== undefined ? normalizeOrgTier(dto.tier) : undefined;

    const updated = await this.platformRepository.updateOrganization(id, {
      status: dto.status,
      tier: normalizedTier,
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

    if (actor && normalizedTier && normalizedTier !== normalizeOrgTier(existing.tier)) {
      await this.billing.syncOrganizationPlanFromPlatform(id, normalizedTier, actor, meta);
    }

    return mapped;
  }

  async deleteOrganization(id: string, actor?: AuthUser, meta?: AuditRequestMeta) {
    const existing = await this.platformRepository.findOrganizationById(id);
    if (!existing) throw new NotFoundException('Organization not found');

    await this.platformRepository.softDeleteOrganization(id);

    await this.auditService.record({
      actor,
      tenantId: id,
      action: 'platform.organization.deleted',
      entityType: 'organization',
      entityId: id,
      beforeState: this.mapOrganization(existing),
      meta,
    });

    return { id, deleted: true };
  }

  async uploadOrganizationLogo(
    id: string,
    dto: UploadOrgLogoDto,
    actor?: AuthUser,
    meta?: AuditRequestMeta,
  ) {
    const existing = await this.platformRepository.findOrganizationById(id);
    if (!existing) throw new NotFoundException('Organization not found');

    let logoUrl = dto.url ?? null;
    if (!logoUrl && dto.content_base64) {
      this.assertValidLogoUpload(dto.content_base64, dto.content_type);
      const stored = await this.storage.saveOrgLogo({
        organizationId: id,
        filename: dto.filename,
        contentBase64: dto.content_base64,
        contentType: dto.content_type,
      });
      logoUrl = stored.storageKey;
    }
    if (!logoUrl) throw new BadRequestException('Provide either url or content_base64');

    if (existing.logo_url && !/^https?:\/\//i.test(existing.logo_url)) {
      await this.storage.delete(existing.logo_url);
    }

    const updated = await this.platformRepository.updateOrganization(id, { logo_url: logoUrl });
    const mapped = this.mapOrganization(updated);
    await this.auditService.record({
      actor,
      tenantId: id,
      action: 'platform.organization.logo_updated',
      entityType: 'organization',
      entityId: id,
      beforeState: { logo_url: this.storage.resolveUrl(existing.logo_url ?? null) },
      afterState: { logo_url: mapped.logo_url },
      meta,
    });

    return mapped;
  }

  async startImpersonation(id: string, actor: AuthUser, meta?: AuditRequestMeta) {
    const org = await this.platformRepository.findOrganizationById(id);
    if (!org) throw new NotFoundException('Organization not found');

    const mapped = this.mapOrganization(org);
    await this.auditService.record({
      actor,
      tenantId: id,
      action: 'platform.impersonation.started',
      entityType: 'organization',
      entityId: id,
      afterState: { name: mapped.name, slug: mapped.slug, tier: mapped.tier },
      meta,
    });

    return {
      tenant_id: mapped.id,
      name: mapped.name,
      slug: mapped.slug,
    };
  }

  async endImpersonation(
    tenantId: string | undefined,
    actor: AuthUser,
    meta?: AuditRequestMeta,
  ) {
    await this.auditService.record({
      actor,
      tenantId: tenantId ?? null,
      action: 'platform.impersonation.ended',
      entityType: 'organization',
      entityId: tenantId ?? null,
      meta,
    });

    return { ended: true };
  }
}
