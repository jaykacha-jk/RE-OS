export interface TenantContext {
  tenantId: string;
  /** Set when Super Admin acts via `X-Tenant-Id` impersonation header. */
  impersonated?: boolean;
  impersonatorUserId?: string;
}

