'use client';

import { useEffect, useState } from 'react';

import { apiFetch } from '../../../../lib/api';
import { getSession } from '../../../../lib/auth';
import type { Property } from '../../../../lib/properties';

type EmployeeOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role_code: string | null;
};

export function AssignModal({
  property,
  onClose,
  onAssigned,
}: {
  property: Property;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(
    property.assignments.map((a) => a.employee_id),
  );
  const [primary, setPrimary] = useState<string | null>(
    property.assignments.find((a) => a.is_primary)?.employee_id ?? null,
  );
  const [manualIds, setManualIds] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session?.access_token) return;
    apiFetch<EmployeeOption[]>('/api/v1/employees?per_page=100', { token: session.access_token })
      .then((res) => setEmployees(res.data))
      .catch((err) =>
        setEmployeesError(
          err instanceof Error ? err.message : 'Unable to load employees; enter IDs manually.',
        ),
      );
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (!next.includes(primary ?? '')) setPrimary(next[0] ?? null);
      return next;
    });
  }

  async function save() {
    const session = getSession();
    if (!session?.access_token) return;

    const manual = manualIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const employeeIds = Array.from(new Set([...selected, ...manual]));
    if (employeeIds.length === 0) {
      setError('Select at least one employee');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/properties/${property.id}/assign`, {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({
          employee_ids: employeeIds,
          primary_employee_id: primary && employeeIds.includes(primary) ? primary : employeeIds[0],
        }),
      });
      onAssigned();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Assign property</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Select agents to assign. One primary agent is required (BR-P06).
        </p>

        {employeesError ? (
          <div className="mt-4">
            <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">{employeesError}</p>
            <label className="mt-2 block text-sm font-medium text-slate-700">Employee IDs (comma separated)</label>
            <input
              value={manualIds}
              onChange={(e) => setManualIds(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="uuid, uuid"
            />
          </div>
        ) : (
          <div className="mt-4 max-h-64 space-y-1 overflow-y-auto rounded border border-slate-200 p-2">
            {employees.length === 0 ? (
              <p className="px-2 py-4 text-sm text-slate-500">No employees available.</p>
            ) : (
              employees.map((emp) => {
                const name = [emp.first_name, emp.last_name].filter(Boolean).join(' ') || emp.email;
                const checked = selected.includes(emp.id);
                return (
                  <div key={emp.id} className="flex items-center justify-between rounded px-2 py-1 hover:bg-slate-50">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={checked} onChange={() => toggle(emp.id)} />
                      <span>
                        {name}
                        <span className="ml-2 text-xs text-slate-400">{emp.role_code ?? ''}</span>
                      </span>
                    </label>
                    {checked ? (
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        <input
                          type="radio"
                          name="primary"
                          checked={primary === emp.id}
                          onChange={() => setPrimary(emp.id)}
                        />
                        Primary
                      </label>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        )}

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border border-slate-300 px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save assignment'}
          </button>
        </div>
      </div>
    </div>
  );
}
