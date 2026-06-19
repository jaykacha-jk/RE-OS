import { apiFetch } from './api';
import { getSession, saveSession, type ImpersonationState } from './auth';

export async function startPlatformImpersonation(orgId: string): Promise<ImpersonationState> {
  const { data } = await apiFetch<{ tenant_id: string; name: string; slug: string }>(
    `/api/v1/platform/organizations/${orgId}/impersonate`,
    { method: 'POST' },
  );

  const session = getSession();
  if (!session) throw new Error('Not signed in');

  const impersonation: ImpersonationState = {
    tenant_id: data.tenant_id,
    org_name: data.name,
    org_slug: data.slug,
  };
  saveSession({ ...session, impersonation });
  return impersonation;
}

export async function endPlatformImpersonation(): Promise<void> {
  const session = getSession();
  const tenantId = session?.impersonation?.tenant_id;
  if (tenantId) {
    try {
      await apiFetch('/api/v1/platform/impersonation/end', {
        method: 'POST',
        body: JSON.stringify({ tenant_id: tenantId }),
      });
    } catch {
      /* clear local state even if audit endpoint fails */
    }
  }
  if (session) {
    saveSession({ ...session, impersonation: undefined });
  }
}
