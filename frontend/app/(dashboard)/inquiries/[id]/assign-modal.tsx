'use client';

import { useEffect, useState } from 'react';

import { apiFetch } from '../../../../lib/api';
import { getSession } from '../../../../lib/auth';
import type { Inquiry } from '../../../../lib/crm';
import { employeeLabel, fetchEmployees, type EmployeeOption } from '../../../../lib/crm-api';
import { ModalShell } from './modal-shell';

export function AssignModal({
  inquiry,
  onClose,
  onDone,
}: {
  inquiry: Inquiry;
  onClose: () => void;
  onDone: () => void;
}) {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selected, setSelected] = useState(inquiry.assigned_employee_id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEmployees().then(setEmployees).catch(() => undefined);
  }, []);

  async function save() {
    const session = getSession();
    if (!session?.access_token) return;
    if (!selected) {
      setError('Select an employee');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/inquiries/${inquiry.id}/assign`, {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({ employee_id: selected }),
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Assign inquiry" onClose={onClose} onSave={save} saving={saving} error={error}>
      <label className="block text-sm font-medium text-slate-700">Owner</label>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">— select employee —</option>
        {employees.map((emp) => (
          <option key={emp.id} value={emp.id}>{employeeLabel(emp)}</option>
        ))}
      </select>
    </ModalShell>
  );
}
