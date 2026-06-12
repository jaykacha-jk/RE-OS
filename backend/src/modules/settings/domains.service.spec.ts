import { AuditService } from '../audit/audit.service';
import { DomainsService } from './domains.service';
import { SettingsRepository } from './settings.repository';
import type { AuthUser } from '../../common/context/auth-user';

const TENANT = 'tenant-1';
const user: AuthUser = { userId: 'u1', tenantId: TENANT, roles: ['org_owner'], permissions: [] };

function build() {
  const repo: jest.Mocked<Partial<SettingsRepository>> = {
    findDomainByHostname: jest.fn().mockResolvedValue(null),
    findDomainById: jest.fn(),
    createDomain: jest.fn(),
    updateDomain: jest.fn(),
    softDeleteDomain: jest.fn(),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const service = new DomainsService(repo as unknown as SettingsRepository, audit);
  return { service, repo, audit };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    domain: 'abc-realty.com',
    is_primary: false,
    ssl_status: 'pending',
    verification_status: 'pending',
    verification_token: 'tok123',
    dns_records: [],
    verified_at: null,
    last_checked_at: null,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('DomainsService', () => {
  describe('create', () => {
    it('generates a verification token + DNS records', async () => {
      const { service, repo } = build();
      repo.createDomain!.mockImplementation((input: any) =>
        Promise.resolve(
          row({ domain: input.domain, verification_token: input.verificationToken, dns_records: input.dnsRecords }),
        ) as never,
      );

      const result = await service.create(TENANT, { domain: 'abc-realty.com' }, user);
      expect(result.verification_token).toHaveLength(32);
      const records = result.dns_records as Array<Record<string, unknown>>;
      expect(records.find((r) => r.type === 'TXT')).toBeDefined();
      expect(records.find((r) => r.type === 'CNAME')).toBeDefined();
    });

    it('rejects a domain already taken by another tenant without leaking ownership', async () => {
      const { service, repo } = build();
      repo.findDomainByHostname!.mockResolvedValue({ tenant_id: 'other', domain: 'abc-realty.com' } as never);
      await expect(service.create(TENANT, { domain: 'abc-realty.com' }, user)).rejects.toThrow(
        'Domain is not available',
      );
    });
  });

  describe('verify', () => {
    it('marks verified + moves SSL to provisioning when the TXT token matches', async () => {
      const { service, repo } = build();
      repo.findDomainById!.mockResolvedValue(row() as never);
      repo.updateDomain!.mockImplementation((input: any) =>
        Promise.resolve(
          row({ verification_status: input.verificationStatus, ssl_status: input.sslStatus }),
        ) as never,
      );
      jest
        .spyOn(service as unknown as { lookupTxt: (h: string) => Promise<string[]> }, 'lookupTxt')
        .mockResolvedValue(['reos-verification=tok123']);

      const result = await service.verify(TENANT, 'd1', user);
      expect(result.verification_status).toBe('verified');
      expect(result.ssl_status).toBe('provisioning');
    });

    it('marks failed when the TXT record is missing', async () => {
      const { service, repo } = build();
      repo.findDomainById!.mockResolvedValue(row() as never);
      repo.updateDomain!.mockImplementation((input: any) =>
        Promise.resolve(row({ verification_status: input.verificationStatus })) as never,
      );
      jest
        .spyOn(service as unknown as { lookupTxt: (h: string) => Promise<string[]> }, 'lookupTxt')
        .mockRejectedValue(new Error('ENOTFOUND'));

      const result = await service.verify(TENANT, 'd1', user);
      expect(result.verification_status).toBe('failed');
    });
  });

  describe('update', () => {
    it('refuses to set an unverified domain as primary', async () => {
      const { service, repo } = build();
      repo.findDomainById!.mockResolvedValue(row({ verification_status: 'pending' }) as never);
      await expect(service.update(TENANT, 'd1', { is_primary: true }, user)).rejects.toThrow(
        'Only a verified domain can be set as primary',
      );
    });
  });

  describe('remove', () => {
    it('404s when the domain does not exist for the tenant', async () => {
      const { service, repo } = build();
      repo.softDeleteDomain!.mockResolvedValue(null as never);
      await expect(service.remove(TENANT, 'missing', user)).rejects.toThrow('Domain not found');
    });
  });
});
