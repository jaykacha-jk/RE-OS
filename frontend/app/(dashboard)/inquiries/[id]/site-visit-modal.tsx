'use client';

import { useEffect, useState } from 'react';

import { apiFetch } from '../../../../lib/api';
import { getSession } from '../../../../lib/auth';
import type { Inquiry } from '../../../../lib/crm';
import {
  employeeLabel,
  fetchEmployees,
  fetchProperties,
  type EmployeeOption,
  type PropertyOption,
} from '../../../../lib/crm-api';
import { ModalShell } from './modal-shell';

const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500';

export function SiteVisitModal({
  inquiry,
  onClose,
  onDone,
}: {
  inquiry: Inquiry;
  onClose: () => void;
  onDone: () => void;
}) {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [propertyId, setPropertyId] = useState(inquiry.property_id ?? '');
  const [employeeId, setEmployeeId] = useState(inquiry.assigned_employee_id ?? '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEmployees().then(setEmployees).catch(() => undefined);
    fetchProperties().then(setProperties).catch(() => undefined);
  }, []);

  async function save() {
    const session = getSession();
    if (!session?.access_token) return;
    if (!scheduledAt) {
      setError('Scheduled date/time is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/inquiries/${inquiry.id}/site-visits`, {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({
          scheduled_at: new Date(scheduledAt).toISOString(),
          property_id: propertyId || undefined,
          employee_id: employeeId || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule site visit');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Schedule site visit" onClose={onClose} onSave={save} saving={saving} error={error} saveLabel="Schedule">
      <div>
        <label className={labelClass}>Scheduled at *</label>
        <input value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} type="datetime-local" className="input" />
      </div>
      <div>
        <label className={labelClass}>Property</label>
        <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="input">
          <option value="">— inquiry property —</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Conducted by</label>
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="input">
          <option value="">— assignee —</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>{employeeLabel(emp)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input" placeholder="Meeting point, customer preference, or visit context…" />
      </div>
    </ModalShell>
  );
}
