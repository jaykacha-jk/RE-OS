'use client';

import { useState } from 'react';

import { apiFetch } from '../../../../lib/api';
import { getSession } from '../../../../lib/auth';

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  tier: string;
  employees_count: number;
};

const STATUSES = ['trial', 'active', 'suspended', 'cancelled'] as const;
const TIERS = ['basic', 'pro', 'enterprise'] as const;

export function EditOrgRow({
  row,
  onUpdated,
}: {
  row: OrganizationRow;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(row.status);
  const [tier, setTier] = useState(row.tier);
  const [name, setName] = useState(row.name);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save() {
    const session = getSession();
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/platform/organizations/${row.id}`, {
        method: 'PATCH',
        token: session.access_token,
        body: JSON.stringify({ status, tier, name }),
      });
      setEditing(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  }

  if (!editing) {
    return (
      <tr className="border-t border-slate-100">
        <td className="px-4 py-3">{row.name}</td>
        <td className="px-4 py-3">{row.slug}</td>
        <td className="px-4 py-3">{row.status}</td>
        <td className="px-4 py-3">{row.tier}</td>
        <td className="px-4 py-3">{row.employees_count}</td>
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm text-teal-700 hover:underline"
          >
            Edit
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-slate-100 bg-slate-50">
      <td className="px-4 py-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </td>
      <td className="px-4 py-3 text-slate-500">{row.slug}</td>
      <td className="px-4 py-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">{row.employees_count}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={save}
              className="text-sm font-medium text-teal-700 hover:underline disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setStatus(row.status);
                setTier(row.tier);
                setName(row.name);
                setError(null);
              }}
              className="text-sm text-slate-600 hover:underline"
            >
              Cancel
            </button>
          </div>
          {error ? <span className="text-xs text-red-600">{error}</span> : null}
        </div>
      </td>
    </tr>
  );
}
