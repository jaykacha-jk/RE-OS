'use client';

import { FormEvent, useEffect, useState } from 'react';

import { apiFetch } from '../../../../lib/api';
import { getSession, saveSession, type AuthSession } from '../../../../lib/auth';

type MeResponse = {
  user_id: string;
  tenant_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  roles: string[];
  permissions: string[];
};

export default function ProfileSettingsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const current = getSession();
    setSession(current);
    if (!current?.access_token) return;

    apiFetch<MeResponse>('/api/v1/auth/me', { token: current.access_token })
      .then((res) => setMe(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load profile'));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token) return;

    const form = new FormData(event.currentTarget);
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const { data } = await apiFetch<MeResponse>('/api/v1/auth/me', {
        method: 'PATCH',
        token: session.access_token,
        body: JSON.stringify({
          first_name: form.get('first_name') || undefined,
          last_name: form.get('last_name') || null,
          phone: form.get('phone') || null,
        }),
      });
      setMe(data);
      const nextSession = {
        ...session,
        user: {
          ...session.user,
          first_name: data.first_name,
        },
      };
      saveSession(nextSession);
      setSession(nextSession);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  if (!session) return null;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Profile settings</h1>
      <p className="mt-1 text-sm text-slate-600">
        Update your account details and review your current tenant access.
      </p>

      {error ? (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 p-4">
          <h2 className="font-medium text-slate-800">Account</h2>
          <form
            key={`${me?.user_id ?? session.user.id}-${me?.first_name ?? ''}-${me?.last_name ?? ''}-${me?.phone ?? ''}`}
            onSubmit={onSubmit}
            className="mt-4 space-y-4 text-sm"
          >
            <label className="block">
              <span className="text-slate-500">First name</span>
              <input
                name="first_name"
                required
                defaultValue={me?.first_name ?? session.user.first_name ?? ''}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-slate-500">Last name</span>
              <input
                name="last_name"
                defaultValue={me?.last_name ?? ''}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-slate-500">Phone</span>
              <input
                name="phone"
                placeholder="+919876543210"
                defaultValue={me?.phone ?? ''}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              />
            </label>
            <div>
              <p className="text-slate-500">Email</p>
              <p className="font-medium">{me?.email ?? session.user.email}</p>
            </div>
            <div>
              <p className="text-slate-500">User ID</p>
              <p className="break-all font-mono text-xs">{session.user.id}</p>
            </div>
            <div>
              <p className="text-slate-500">Tenant</p>
              <p className="break-all font-mono text-xs">
                {me?.tenant_id ?? session.user.tenant_id ?? 'Platform'}
              </p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save profile'}
            </button>
            {saved ? <p className="text-sm text-emerald-700">Profile updated.</p> : null}
          </form>
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
