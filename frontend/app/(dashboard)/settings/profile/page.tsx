'use client';

import { FormEvent, useEffect, useState } from 'react';

import { PhoneInput } from '../../../../components/ui';
import { apiFetch } from '../../../../lib/api';
import { getSession, isSuperAdmin, saveSession, type AuthSession } from '../../../../lib/auth';
import { isValidIndianMobile, parseNationalDigits, toE164 } from '../../../../lib/phone';

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

function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ProfileSettingsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const current = getSession();
    setSession(current);
    if (!current?.access_token) return;

    apiFetch<MeResponse>('/api/v1/auth/me', { token: current.access_token })
      .then((res) => {
        setMe(res.data);
        setPhone(res.data.phone ?? '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load profile'));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token) return;

    const form = new FormData(event.currentTarget);
    const national = parseNationalDigits(phone);
    if (phone.trim() && !isValidIndianMobile(national)) {
      setError('Please match the requested format.');
      return;
    }

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
          phone: phone.trim() ? toE164(national) : null,
        }),
      });
      setMe(data);
      setPhone(data.phone ?? '');
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

  const roles = me?.roles ?? session.user.roles;
  const primaryRole = isSuperAdmin(session) ? 'Platform administrator' : formatRole(roles[0] ?? 'Workspace user');

  return (
    <div>
      <h1 className="text-2xl font-semibold">Profile settings</h1>
      <p className="mt-1 text-sm text-slate-600">Update your account details.</p>

      {error ? (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <section className="mt-6 max-w-xl rounded-lg border border-slate-200 p-4">
        <h2 className="font-medium text-slate-800">Account</h2>
        <form
          key={`${me?.user_id ?? session.user.id}-${me?.first_name ?? ''}-${me?.last_name ?? ''}`}
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
          <div>
            <span className="text-slate-500">Phone</span>
            <div className="mt-1">
              <PhoneInput value={phone} onChange={setPhone} />
            </div>
          </div>
          <div>
            <p className="text-slate-500">Email</p>
            <p className="font-medium">{me?.email ?? session.user.email}</p>
          </div>
          <div>
            <p className="text-slate-500">Role</p>
            <p className="font-medium capitalize">{primaryRole}</p>
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
    </div>
  );
}
