'use client';

import { FormEvent, useState } from 'react';

import { apiFetch } from '../../../lib/api';
import { getSession } from '../../../lib/auth';

const ROLES = [
  'org_admin',
  'sales_manager',
  'sales_executive',
  'telecaller',
] as const;

type CreateEmployeeResponse = {
  employee: {
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
  invitation_sent: boolean;
  invitation_email_status?: string;
  invitation_pending: boolean;
  accept_url?: string;
  expires_at?: string;
};

export function CreateEmployeeForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<CreateEmployeeResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const session = getSession();
    if (!session?.access_token) return;

    const form = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    setInvite(null);
    setCopied(false);

    try {
      const { data } = await apiFetch<CreateEmployeeResponse>('/api/v1/employees', {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({
          first_name: form.get('first_name'),
          last_name: form.get('last_name'),
          email: form.get('email'),
          phone: form.get('phone') || undefined,
          role_code: form.get('role_code'),
        }),
      });
      e.currentTarget.reset();
      setInvite(data);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setLoading(false);
    }
  }

  async function copyInviteLink() {
    if (!invite?.accept_url) return;
    await navigator.clipboard.writeText(invite.accept_url);
    setCopied(true);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white"
      >
        Add employee
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mb-6 rounded-lg border border-slate-200 p-4">
      <h2 className="font-medium">New employee</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input name="first_name" required placeholder="First name" className="rounded border px-3 py-2" />
        <input name="last_name" required placeholder="Last name" className="rounded border px-3 py-2" />
        <input name="email" type="email" required placeholder="Email" className="rounded border px-3 py-2 sm:col-span-2" />
        <input name="phone" placeholder="+919876543210" className="rounded border px-3 py-2 sm:col-span-2" />
        <select name="role_code" required className="rounded border px-3 py-2 sm:col-span-2">
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      {invite ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="font-semibold">
            Invitation {invite.invitation_sent ? 'email queued' : 'created'}
          </p>
          <p className="mt-1">
            {invite.employee.email} can accept the invitation from their email.
          </p>
          {invite.expires_at ? (
            <p className="mt-1 text-xs text-emerald-700">
              Link expires {new Date(invite.expires_at).toLocaleString()}.
            </p>
          ) : null}
          {invite.accept_url ? (
            <div className="mt-3 rounded border border-emerald-200 bg-white p-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Copy invite link fallback
              </p>
              <p className="mt-1 break-all font-mono text-xs text-slate-700">{invite.accept_url}</p>
              <button
                type="button"
                onClick={copyInviteLink}
                className="mt-2 rounded border border-emerald-300 px-3 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
              >
                {copied ? 'Copied' : 'Copy invite link'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={loading} className="rounded bg-teal-700 px-4 py-2 text-sm text-white">
          {loading ? 'Saving…' : 'Create'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setInvite(null);
            setError(null);
          }}
          className="rounded border px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
