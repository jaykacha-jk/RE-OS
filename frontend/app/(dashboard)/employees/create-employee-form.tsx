'use client';

import { FormEvent, useState } from 'react';

import { apiFetch } from '../../../lib/api';
import { getSession } from '../../../lib/auth';

const ROLES = [
  'org_admin',
  'sales_manager',
  'sales_executive',
  'telecaller',
  'marketing_user',
] as const;

export function CreateEmployeeForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const session = getSession();
    if (!session?.access_token) return;

    const form = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);

    try {
      await apiFetch('/api/v1/employees', {
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
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setLoading(false);
    }
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
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={loading} className="rounded bg-teal-700 px-4 py-2 text-sm text-white">
          {loading ? 'Saving…' : 'Create'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded border px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
