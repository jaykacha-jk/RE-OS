'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

import { apiFetch } from '../../../lib/api';
import { getSession, hasPermission } from '../../../lib/auth';
import { downloadAuditCsv } from '../../../lib/settings';

type AuditLogRow = {
  id: string;
  tenant_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

type AuditMeta = {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
};

export default function AuditLogsPage() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [meta, setMeta] = useState<AuditMeta | null>(null);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [actorEmail, setActorEmail] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const canExport = hasPermission(getSession(), 'audit.logs.export');

  const buildParams = useCallback(
    (page = 1) => {
      const params = new URLSearchParams({ page: String(page), per_page: '20' });
      if (action.trim()) params.set('action', action.trim());
      if (entityType.trim()) params.set('entity_type', entityType.trim());
      if (actorEmail.trim()) params.set('actor_email', actorEmail.trim());
      if (dateFrom) params.set('date_from', new Date(dateFrom).toISOString());
      if (dateTo) params.set('date_to', new Date(dateTo).toISOString());
      return params;
    },
    [action, entityType, actorEmail, dateFrom, dateTo],
  );

  const load = useCallback(
    (page = 1) => {
      const session = getSession();
      if (!session?.access_token) return;

      setLoading(true);
      setError(null);
      apiFetch<AuditLogRow[]>(`/api/v1/audit-logs?${buildParams(page).toString()}`, {
        token: session.access_token,
      })
        .then((res) => {
          setRows(res.data);
          setMeta(res.meta as AuditMeta);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load audit logs'))
        .finally(() => setLoading(false));
    },
    [buildParams],
  );

  useEffect(() => {
    load();
  }, [load]);

  function onFilter(e: FormEvent) {
    e.preventDefault();
    load(1);
  }

  async function onExport() {
    try {
      const params = buildParams(1);
      params.delete('page');
      params.delete('per_page');
      await downloadAuditCsv(params);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Audit logs</h1>
      <p className="mt-1 text-sm text-slate-600">
        Tenant-scoped activity trail for auth, organization, and employee changes.
      </p>

      <form onSubmit={onFilter} className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 p-4">
        <input
          type="text"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="action, e.g. employees.created"
        />
        <input
          type="text"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="entity type, e.g. employee"
        />
        <input
          type="text"
          value={actorEmail}
          onChange={(e) => setActorEmail(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="actor email"
        />
        <label className="flex flex-col text-xs text-slate-500">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-slate-500">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button type="submit" className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white">
          Filter
        </button>
        {canExport ? (
          <button
            type="button"
            onClick={onExport}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </button>
        ) : null}
      </form>

      {loading ? <p className="mt-6 text-slate-500">Loading…</p> : null}
      {error ? (
        <p className="mt-6 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {!loading && !error ? (
        <div className="scrollbar-thin mt-6 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-slate-500">
                    No audit logs yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{row.actor_email ?? 'System'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.action}</td>
                    <td className="px-4 py-3">
                      {row.entity_type ?? '—'}
                      {row.entity_id ? (
                        <span className="block truncate font-mono text-xs text-slate-500">
                          {row.entity_id}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {meta ? (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {meta.page} of {meta.total_pages} · {meta.total} total
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={meta.page <= 1}
              onClick={() => load(meta.page - 1)}
              className="rounded border border-slate-300 px-3 py-1 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={meta.page >= meta.total_pages}
              onClick={() => load(meta.page + 1)}
              className="rounded border border-slate-300 px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
