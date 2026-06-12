import type { AuthUser } from '../../common/context/auth-user';
import { AuditRepository } from './audit.repository';
import { AuditService, csvCell } from './audit.service';

const user: AuthUser = { userId: 'u1', tenantId: 'tenant-1', roles: ['org_admin'], permissions: [] };

function build() {
  const repo: jest.Mocked<Partial<AuditRepository>> = {
    list: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
    listForExport: jest.fn().mockResolvedValue([]),
  };
  return { service: new AuditService(repo as unknown as AuditRepository), repo };
}

describe('csvCell', () => {
  it('passes through simple values', () => {
    expect(csvCell('hello')).toBe('hello');
    expect(csvCell(123)).toBe('123');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes and escapes values containing commas, quotes or newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });
});

describe('AuditService.exportCsv', () => {
  it('emits a header row + one line per audit log with JSON-encoded states', async () => {
    const { service, repo } = build();
    repo.listForExport!.mockResolvedValue([
      {
        id: 'a1',
        tenant_id: 'tenant-1',
        actor_id: 'u1',
        actor_email: 'owner@demo.realty',
        action: 'settings.branding.updated',
        entity_type: 'tenant_settings',
        entity_id: 'branding',
        before_state: { primary_color: '#000' },
        after_state: { primary_color: '#fff' },
        ip_address: '127.0.0.1',
        user_agent: 'jest',
        created_at: new Date('2026-06-10T00:00:00.000Z'),
      },
    ] as never);

    const csv = await service.exportCsv(user, {} as never);
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('id,tenant_id,actor_id,actor_email,action');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('settings.branding.updated');
    // before/after states are serialized + CSV-quoted (they contain commas/quotes).
    expect(lines[1]).toContain('primary_color');
  });

  it('forwards tenant + filters to the repository', async () => {
    const { service, repo } = build();
    await service.exportCsv(user, { action: 'settings.seo.updated', date_from: '2026-01-01' } as never);
    expect(repo.listForExport).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        action: 'settings.seo.updated',
        dateFrom: '2026-01-01',
        limit: 10_000,
      }),
    );
  });
});
