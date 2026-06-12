'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

import { apiFetch } from '../../../lib/api';
import { getSession, hasPermission } from '../../../lib/auth';
import type { LeadSource } from '../../../lib/crm';

export default function LeadSourcesPage() {
  const [rows, setRows] = useState<LeadSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCanManage(hasPermission(getSession(), 'crm.lead_sources.manage'));
  }, []);

  const load = useCallback(() => {
    const session = getSession();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    apiFetch<LeadSource[]>('/api/v1/lead-sources?include_inactive=true', {
      token: session.access_token,
    })
      .then((res) => setRows(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load lead sources'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    const session = getSession();
    if (!session?.access_token || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/v1/lead-sources', {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({ name: name.trim(), code: code.trim() || undefined }),
      });
      setName('');
      setCode('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lead source');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(source: LeadSource) {
    const session = getSession();
    if (!session?.access_token) return;
    try {
      await apiFetch(`/api/v1/lead-sources/${source.id}`, {
        method: 'PATCH',
        token: session.access_token,
        body: JSON.stringify({ is_active: !source.is_active }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lead source');
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Lead sources</h1>
      <p className="mt-1 text-sm text-slate-600">
        Manage where your leads come from. Sources power inquiry attribution and reporting.
      </p>

      {error ? <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {canManage ? (
        <form onSubmit={create} className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 p-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Google Ads" />
          </div>
          <div className="w-40">
            <label className="block text-sm font-medium text-slate-700">Code</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="optional" />
          </div>
          <button type="submit" disabled={saving} className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {saving ? 'Saving…' : 'Add source'}
          </button>
        </form>
      ) : null}

      {loading ? <p className="mt-6 text-slate-500">Loading…</p> : null}

      {!loading ? (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {canManage ? <th className="px-4 py-3 font-medium">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 5 : 4} className="px-4 py-10 text-center text-slate-500">
                    No lead sources yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.code ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{row.is_system ? 'System' : 'Custom'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${row.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}`}>
                        {row.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => toggleActive(row)} className="text-sm text-teal-700 hover:underline">
                          {row.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
