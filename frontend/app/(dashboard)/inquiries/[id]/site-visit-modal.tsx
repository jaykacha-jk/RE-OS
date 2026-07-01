'use client';

import { useEffect, useState } from 'react';

import { FormDrawer, FormField } from '../../../../components/ui';
import { apiFetch, hydrateSession } from '../../../../lib/api';
import { getBearerToken, getSession, hasActiveSession } from '../../../../lib/auth';
import type { Inquiry } from '../../../../lib/crm';
import {
  employeeLabel,
  fetchEmployees,
  fetchProperties,
  type EmployeeOption,
  type PropertyOption,
} from '../../../../lib/crm-api';

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
    let session = getSession();
    if (!hasActiveSession(session)) {
      session = await hydrateSession();
    }
    if (!hasActiveSession(session)) {
      setError('Your session has expired. Please sign in again.');
      return;
    }
    if (!scheduledAt) {
      setError('Scheduled date/time is required');
      return;
    }
    const scheduled = new Date(scheduledAt);
    if (Number.isNaN(scheduled.getTime())) {
      setError('Scheduled date/time is invalid');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/inquiries/${inquiry.id}/site-visits`, {
        method: 'POST',
        token: getBearerToken(session),
        body: JSON.stringify({
          scheduled_at: scheduled.toISOString(),
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
    <FormDrawer
      open
      title="Schedule site visit"
      description="Complete this quick CRM action without leaving the record."
      onClose={onClose}
      onSubmit={save}
      submitting={saving}
      error={error}
      submitLabel="Schedule"
    >
      <FormField label="Scheduled at" required>
        <input value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} type="datetime-local" className="input" />
      </FormField>
      <FormField label="Property">
        <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="input">
          <option value="">— inquiry property —</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Conducted by">
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
          placeholder="Meeting point, customer preference, or visit context…"
        />
      </FormField>
    </FormDrawer>
  );
}
