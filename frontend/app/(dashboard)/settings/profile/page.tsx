'use client';

import { useEffect, useState } from 'react';

import { apiFetch } from '../../../../lib/api';
import { getSession, type AuthSession } from '../../../../lib/auth';

type MeResponse = {
  user_id: string;
  tenant_id: string | null;
  roles: string[];
  permissions: string[];
};

export default function ProfileSettingsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const current = getSession();
    setSession(current);
    if (!current?.access_token) return;

    apiFetch<MeResponse>('/api/v1/auth/me', { token: current.access_token })
      .then((res) => setMe(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load profile'));
  }, []);

  if (!session) return null;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Profile settings</h1>
      <p className="mt-1 text-sm text-slate-600">
        Your current account, tenant, roles, and permissions.
      </p>

      {error ? (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 p-4">
          <h2 className="font-medium text-slate-800">Account</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium">{session.user.email}</dd>
            </div>
            <div>
              <dt className="text-slate-500">User ID</dt>
              <dd className="break-all font-mono text-xs">{session.user.id}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Tenant</dt>
              <dd className="break-all font-mono text-xs">
                {me?.tenant_id ?? session.user.tenant_id ?? 'Platform'}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 p-4">
          <h2 className="font-medium text-slate-800">Access</h2>
          <div className="mt-4">
            <p className="text-sm text-slate-500">Roles</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(me?.roles ?? session.user.roles).map((role) => (
                <span key={role} className="rounded-full bg-teal-50 px-3 py-1 text-xs text-teal-800">
                  {role}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm text-slate-500">Permissions</p>
            <div className="mt-2 flex max-h-56 flex-wrap gap-2 overflow-auto">
              {(me?.permissions ?? session.user.permissions).map((permission) => (
                <span key={permission} className="rounded bg-slate-100 px-2 py-1 font-mono text-xs">
                  {permission}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
