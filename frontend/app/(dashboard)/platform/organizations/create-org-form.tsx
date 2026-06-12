'use client';

import { FormEvent, useState } from 'react';

import { apiFetch } from '../../../../lib/api';
import { getSession } from '../../../../lib/auth';

export function CreateOrgForm({ onCreated }: { onCreated: () => void }) {
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
      await apiFetch('/api/v1/platform/organizations', {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({
          name: form.get('name'),
          slug: form.get('slug'),
          tier: form.get('tier'),
          billing_email: form.get('billing_email'),
          owner_email: form.get('owner_email'),
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
        Create organization
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mb-6 rounded-lg border border-slate-200 p-4">
      <h2 className="font-medium">New organization</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input name="name" required placeholder="Organization name" className="rounded border px-3 py-2 sm:col-span-2" />
        <input name="slug" required placeholder="slug (e.g. abc-realty)" className="rounded border px-3 py-2" />
        <select name="tier" required className="rounded border px-3 py-2">
          <option value="basic">basic</option>
          <option value="pro">pro</option>
          <option value="enterprise">enterprise</option>
        </select>
        <input name="billing_email" type="email" required placeholder="Billing email" className="rounded border px-3 py-2 sm:col-span-2" />
        <input name="owner_email" type="email" required placeholder="Owner email" className="rounded border px-3 py-2 sm:col-span-2" />
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
