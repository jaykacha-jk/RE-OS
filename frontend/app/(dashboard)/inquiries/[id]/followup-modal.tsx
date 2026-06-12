'use client';

import { useEffect, useState } from 'react';

import { apiFetch } from '../../../../lib/api';
import { getSession } from '../../../../lib/auth';
import { FOLLOWUP_TYPES, humanize, type Inquiry } from '../../../../lib/crm';
import { employeeLabel, fetchEmployees, type EmployeeOption } from '../../../../lib/crm-api';
import { ModalShell } from './modal-shell';

const inputClass = 'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm';

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
    <ModalShell title="Schedule follow-up" onClose={onClose} onSave={save} saving={saving} error={error} saveLabel="Create">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Date *</label>
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Time</label>
          <input value={time} onChange={(e) => setTime(e.target.value)} type="time" className={inputClass} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Type</label>
        <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
          {FOLLOWUP_TYPES.map((t) => (
            <option key={t} value={t}>{humanize(t)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Owner</label>
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass}>
          <option value="">— assignee —</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>{employeeLabel(emp)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </div>
    </ModalShell>
  );
}
