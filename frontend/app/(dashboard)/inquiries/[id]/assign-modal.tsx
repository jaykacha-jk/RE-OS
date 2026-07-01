'use client';

import { useEffect, useState } from 'react';

import { FormDrawer, FormField } from '../../../../components/ui';
import { apiFetch } from '../../../../lib/api';
import { getSession } from '../../../../lib/auth';
import type { Inquiry } from '../../../../lib/crm';
import { employeeLabel, fetchEmployees, type EmployeeOption } from '../../../../lib/crm-api';

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
    <FormDrawer
      open
      title="Assign inquiry"
      description="Complete this quick CRM action without leaving the record."
      onClose={onClose}
      onSubmit={save}
      submitting={saving}
      error={error}
    >
      <FormField label="Owner">
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="input">
          <option value="">— select employee —</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {employeeLabel(emp)}
            </option>
          ))}
        </select>
      </FormField>
    </FormDrawer>
  );
}
