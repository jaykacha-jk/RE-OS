import {
  MissingTenantScopeError,
  TenantScopedRepository,
} from './tenant-scoped.repository';

class TestTenantRepository extends TenantScopedRepository {
  where(tenantId: string, where?: Record<string, unknown>) {
    return this.tenantWhere(tenantId, where);
  }

  data(tenantId: string, data?: Record<string, unknown>) {
    return this.tenantData(tenantId, data);
  }

  assert(context: string, where?: Record<string, unknown> | null) {
    return this.assertTenantWhere(context, where);
  }
}

describe('TenantScopedRepository', () => {
  const repo = new TestTenantRepository();

  it('appends tenant_id to query filters and write data', () => {
    expect(repo.where('tenant-1', { deleted_at: null })).toEqual({
      tenant_id: 'tenant-1',
      deleted_at: null,
    });
    expect(repo.data('tenant-1', { status: 'active' })).toEqual({
      tenant_id: 'tenant-1',
      status: 'active',
    });
  });

  it('rejects tenant-scoped operations without tenant_id', () => {
    expect(() => repo.assert('TestRepository.list', { deleted_at: null })).toThrow(
      MissingTenantScopeError,
    );
    expect(() => repo.assert('TestRepository.list', { tenant_id: 'tenant-1' })).not.toThrow();
  });
});
