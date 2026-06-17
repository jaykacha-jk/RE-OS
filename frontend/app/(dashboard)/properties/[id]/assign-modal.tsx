'use client';

import { useEffect, useState } from 'react';

import { Drawer } from '../../../../components/ui';
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

    const employeeIds = Array.from(new Set(selected));
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
    <Drawer
      open
      onClose={onClose}
      title="Assign property"
      description="Select agents to assign. One primary agent is required (BR-P06)."
      width="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save assignment'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {employeesError ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            {employeesError} Refresh the page or try again later.
          </p>
        ) : (
          <div className="max-h-96 space-y-1 overflow-y-auto rounded-2xl border border-reos-border p-2 scrollbar-thin">
            {employees.length === 0 ? (
              <p className="px-2 py-4 text-sm text-slate-500">No employees available.</p>
            ) : (
              employees.map((emp) => {
                const name = [emp.first_name, emp.last_name].filter(Boolean).join(' ') || emp.email;
                const checked = selected.includes(emp.id);
                return (
                  <div key={emp.id} className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-teal-50">
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

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}
