'use client';

import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '../../../../lib/api';
import { getSession } from '../../../../lib/auth';
import { CreateOrgForm } from './create-org-form';
import { EditOrgRow } from './edit-org-row';

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  tier: string;
  employees_count: number;
};

export default function OrganizationsPage() {
  const [rows, setRows] = useState<OrganizationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const session = getSession();
    if (!session?.access_token) return;

    setLoading(true);
    apiFetch<OrganizationRow[]>('/api/v1/platform/organizations', {
      token: session.access_token,
    })
      .then((res) => setRows(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Organizations</h1>
      <p className="mt-1 text-sm text-slate-600">Super Admin platform view</p>

      <div className="mt-4">
        <CreateOrgForm onCreated={load} />
      </div>

      {loading ? <p className="mt-6 text-slate-500">Loading…</p> : null}
      {error ? (
        <p className="mt-6 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {!loading && !error ? (
        <div className="scrollbar-thin mt-6 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Employees</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <EditOrgRow key={row.id} row={row} onUpdated={load} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
