'use client';

import { useEffect, useState } from 'react';

import { FormDrawer, FormField } from '../../../../components/ui';
import { apiFetch } from '../../../../lib/api';
import { getSession } from '../../../../lib/auth';
import { FOLLOWUP_TYPES, humanize, type Inquiry } from '../../../../lib/crm';
import { employeeLabel, fetchEmployees, type EmployeeOption } from '../../../../lib/crm-api';

export function FollowupModal({
  inquiry,
  onClose,
  onDone,
}: {
  inquiry: Inquiry;
  onClose: () => void;
  onDone: () => void;
}) {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [type, setType] = useState('call');
  const [employeeId, setEmployeeId] = useState(inquiry.assigned_employee_id ?? '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEmployees().then(setEmployees).catch(() => undefined);
  }, []);

  async function save() {
    const session = getSession();
    if (!session?.access_token) return;
    if (!date) {
      setError('Follow-up date is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/inquiries/${inquiry.id}/followups`, {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({
          followup_date: date,
          followup_time: time || undefined,
          followup_type: type,
          assigned_employee_id: employeeId || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create follow-up');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDrawer
      open
      title="Schedule follow-up"
      description="Complete this quick CRM action without leaving the record."
      onClose={onClose}
      onSubmit={save}
      submitting={saving}
      error={error}
      submitLabel="Create"
    >
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Date" required>
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className="input" />
        </FormField>
        <FormField label="Time">
          <input value={time} onChange={(e) => setTime(e.target.value)} type="time" className="input" />
        </FormField>
      </div>
      <FormField label="Type">
        <select value={type} onChange={(e) => setType(e.target.value)} className="input">
          {FOLLOWUP_TYPES.map((t) => (
            <option key={t} value={t}>
              {humanize(t)}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Owner">
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="input">
          <option value="">— assignee —</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {employeeLabel(emp)}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Notes" full>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="input"
          placeholder="Context for the next conversation…"
        />
      </FormField>
    </FormDrawer>
  );
}
