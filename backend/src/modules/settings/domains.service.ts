import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { resolveTxt } from 'node:dns/promises';
import { randomBytes } from 'node:crypto';

import type { AuthUser } from '../../common/context/auth-user';
import { AuditService, type AuditRequestMeta } from '../audit/audit.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { UpdateDomainDto } from './dto/update-domain.dto';
import { SettingsRepository } from './settings.repository';

type DomainRow = NonNullable<Awaited<ReturnType<SettingsRepository['findDomainById']>>>;

const VERIFICATION_HOST = process.env.PLATFORM_VERIFICATION_HOST ?? '_reos-verify';
const PLATFORM_CNAME_TARGET = process.env.PLATFORM_CNAME_TARGET ?? 'cname.reos.com';

@Injectable()
export class DomainsService {
  constructor(
    private readonly repo: SettingsRepository,
    private readonly audit: AuditService,
  ) {}

  private buildDnsRecords(domain: string, token: string) {
    return [
      {
        type: 'TXT',
        host: `${VERIFICATION_HOST}.${domain}`,
        value: `reos-verification=${token}`,
        purpose: 'verification',
      },
      {
        type: 'CNAME',
        host: domain,
        value: PLATFORM_CNAME_TARGET,
        purpose: 'routing',
      },
    ];
  }

  private map(row: DomainRow) {
    return {
      id: row.id,
      domain: row.domain,
      is_primary: row.is_primary,
      ssl_status: row.ssl_status,
      verification_status: row.verification_status,
      verification_token: row.verification_token,
      dns_records: row.dns_records,
      verified_at: row.verified_at?.toISOString() ?? null,
      last_checked_at: row.last_checked_at?.toISOString() ?? null,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }

  async list(tenantId: string) {
    const rows = await this.repo.listDomains(tenantId);
    return rows.map((r) => this.map(r));
  }

  async getOne(tenantId: string, id: string) {
    const row = await this.repo.findDomainById(tenantId, id);
    if (!row) throw new NotFoundException('Domain not found');
    return this.map(row);
  }

  async create(tenantId: string, dto: CreateDomainDto, actor: AuthUser, meta?: AuditRequestMeta) {
    const existing = await this.repo.findDomainByHostname(dto.domain);
    if (existing) {
      // Mirror cross-tenant 404 policy: never reveal another tenant owns it.
      if (existing.tenant_id === tenantId) {
        throw new ConflictException('Domain already added');
      }
      throw new ConflictException('Domain is not available');
    }

    const token = randomBytes(16).toString('hex');
    const row = await this.repo.createDomain({
      tenantId,
      domain: dto.domain,
      isPrimary: dto.is_primary ?? false,
      verificationToken: token,
      dnsRecords: this.buildDnsRecords(dto.domain, token),
    });

    await this.audit.record({
      actor,
      tenantId,
      action: 'settings.domain.added',
      entityType: 'custom_domain',
      entityId: row.id,
      afterState: { domain: row.domain, is_primary: row.is_primary },
      meta,
    });

    return this.map(row);
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateDomainDto,
    actor: AuthUser,
    meta?: AuditRequestMeta,
  ) {
    const existing = await this.repo.findDomainById(tenantId, id);
    if (!existing) throw new NotFoundException('Domain not found');

    if (dto.is_primary === true && existing.verification_status !== 'verified') {
      throw new BadRequestException('Only a verified domain can be set as primary');
    }

    const row = await this.repo.updateDomain({
      tenantId,
      id,
      isPrimary: dto.is_primary,
      sslStatus: dto.ssl_status,
    });
    if (!row) throw new NotFoundException('Domain not found');

    await this.audit.record({
      actor,
      tenantId,
      action: 'settings.domain.updated',
      entityType: 'custom_domain',
      entityId: id,
      beforeState: { is_primary: existing.is_primary, ssl_status: existing.ssl_status },
      afterState: { is_primary: row.is_primary, ssl_status: row.ssl_status },
      meta,
    });

    return this.map(row);
  }

  async remove(tenantId: string, id: string, actor: AuthUser, meta?: AuditRequestMeta) {
    const deleted = await this.repo.softDeleteDomain(tenantId, id);
    if (!deleted) throw new NotFoundException('Domain not found');

    await this.audit.record({
      actor,
      tenantId,
      action: 'settings.domain.removed',
      entityType: 'custom_domain',
      entityId: id,
      beforeState: { domain: deleted.domain },
      meta,
    });

    return { id, deleted: true };
  }

  /**
   * Attempts to verify domain ownership by resolving the TXT verification
   * record. On success, marks the domain verified and moves SSL into
   * provisioning. DNS resolution is isolated in `lookupTxt` so it can be mocked
   * in tests and swapped for a managed DNS/ACME integration in production.
   */
  async verify(tenantId: string, id: string, actor: AuthUser, meta?: AuditRequestMeta) {
    const existing = await this.repo.findDomainById(tenantId, id);
    if (!existing) throw new NotFoundException('Domain not found');

    const expected = `reos-verification=${existing.verification_token}`;
    let verified = false;
    try {
      const records = await this.lookupTxt(`${VERIFICATION_HOST}.${existing.domain}`);
      verified = records.some((r) => r.trim() === expected);
    } catch {
      verified = false;
    }

    const row = await this.repo.updateDomain({
      tenantId,
      id,
      verificationStatus: verified ? 'verified' : 'failed',
      sslStatus: verified ? 'provisioning' : existing.ssl_status,
      verifiedAt: verified ? new Date() : null,
      lastCheckedAt: new Date(),
    });
    if (!row) throw new NotFoundException('Domain not found');

    await this.audit.record({
      actor,
      tenantId,
      action: verified ? 'settings.domain.verified' : 'settings.domain.verification_failed',
      entityType: 'custom_domain',
      entityId: id,
      afterState: { verification_status: row.verification_status },
      meta,
    });

    return this.map(row);
  }

  /** Isolated DNS lookup — flattens TXT chunks into whole strings. */
  protected async lookupTxt(host: string): Promise<string[]> {
    const records = await resolveTxt(host);
    return records.map((chunks) => chunks.join(''));
  }
}
