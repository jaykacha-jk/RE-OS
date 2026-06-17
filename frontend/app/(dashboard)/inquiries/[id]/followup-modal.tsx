'use client';

import { useEffect, useState } from 'react';

import { apiFetch } from '../../../../lib/api';
import { getSession } from '../../../../lib/auth';
import { FOLLOWUP_TYPES, humanize, type Inquiry } from '../../../../lib/crm';
import { employeeLabel, fetchEmployees, type EmployeeOption } from '../../../../lib/crm-api';
import { ModalShell } from './modal-shell';

const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500';

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
          <label className={labelClass}>Date *</label>
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className="input" />
        </div>
        <div>
          <label className={labelClass}>Time</label>
          <input value={time} onChange={(e) => setTime(e.target.value)} type="time" className="input" />
        </div>
      </div>
      <div>
        <label className={labelClass}>Type</label>
        <select value={type} onChange={(e) => setType(e.target.value)} className="input">
          {FOLLOWUP_TYPES.map((t) => (
            <option key={t} value={t}>{humanize(t)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Owner</label>
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="input">
          <option value="">— assignee —</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>{employeeLabel(emp)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input" placeholder="Context for the next conversation…" />
      </div>
    </ModalShell>
  );
}
