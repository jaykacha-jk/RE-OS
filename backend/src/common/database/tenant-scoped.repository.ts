type TenantScopedWhere = Record<string, unknown> & { tenant_id?: unknown };

export class MissingTenantScopeError extends Error {
  constructor(context: string) {
    super(`${context} must include tenant_id`);
    this.name = 'MissingTenantScopeError';
  }
}

export abstract class TenantScopedRepository {
  protected tenantWhere<T extends Record<string, unknown>>(
    tenantId: string,
    where?: T,
  ): T & { tenant_id: string } {
    return { ...(where ?? ({} as T)), tenant_id: tenantId };
  }

  protected tenantData<T extends Record<string, unknown>>(
    tenantId: string,
    data?: T,
  ): T & { tenant_id: string } {
    return { ...(data ?? ({} as T)), tenant_id: tenantId };
  }

  protected assertTenantWhere(
    context: string,
    where: TenantScopedWhere | null | undefined,
  ): asserts where is TenantScopedWhere & { tenant_id: unknown } {
    if (!where || where.tenant_id === undefined || where.tenant_id === null) {
      throw new MissingTenantScopeError(context);
    }
  }
}
