'use client';

import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '../../../lib/api';
import { getSession, hasPermission } from '../../../lib/auth';
import { CreateEmployeeForm } from './create-employee-form';

type EmployeeRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role_code: string | null;
  status: string;
};

export default function EmployeesPage() {
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Permission flags are resolved after mount to avoid SSR/localStorage hydration mismatch.
  const [canCreate, setCanCreate] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  async function removeEmployee(id: string) {
    const session = getSession();
    if (!session?.access_token) return;
    if (!window.confirm('Remove this employee?')) return;

    setError(null);
    try {
      await apiFetch(`/api/v1/employees/${id}`, {
        method: 'DELETE',
        token: session.access_token,
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  const load = useCallback(() => {
    const session = getSession();
    if (!session?.access_token) return;

    setLoading(true);
    apiFetch<EmployeeRow[]>('/api/v1/employees', { token: session.access_token })
      .then((res) => setRows(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const session = getSession();
    setCanCreate(hasPermission(session, 'employees.create'));
    setCanDelete(hasPermission(session, 'employees.delete'));
    load();
  }, [load]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Employees</h1>
      <p className="mt-1 text-sm text-slate-600">Tenant-scoped employee list</p>

      {canCreate ? (
        <div className="mt-4">
          <CreateEmployeeForm onCreated={load} />
        </div>
      ) : null}

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
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-slate-500">
                    No employees yet. Use Create employee above.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      {[row.first_name, row.last_name].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-4 py-3">{row.email}</td>
                    <td className="px-4 py-3">{row.role_code ?? '—'}</td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3">
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => removeEmployee(row.id)}
                          className="text-sm text-red-700 hover:underline"
                        >
                          Remove
                        </button>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
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
