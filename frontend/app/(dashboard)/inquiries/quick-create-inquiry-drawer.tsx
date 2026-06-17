'use client';

import { useEffect, useState } from 'react';

import {
  Combobox,
  FormDrawer,
  FormField,
  FormSection,
  PhoneInput,
  type ComboboxOption,
} from '../../../components/ui';
import { apiFetch } from '../../../lib/api';
import { getSession } from '../../../lib/auth';
import type { Inquiry, LeadSource } from '../../../lib/crm';
import {
  employeeLabel,
  fetchEmployees,
  fetchLeadSources,
  type EmployeeOption,
} from '../../../lib/crm-api';
import { isValidIndianMobile, parseNationalDigits, toE164 } from '../../../lib/phone';

type QuickCreateInquiryDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (inquiry: Inquiry, options: { openDetail: boolean }) => void;
};

const EMPTY_FORM = {
  clientName: '',
  phone: '',
  sourceId: '',
  sourceName: '',
  assignedEmployeeId: '',
};

export function QuickCreateInquiryDrawer({
  open,
  onClose,
  onCreated,
}: QuickCreateInquiryDrawerProps) {
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchLeadSources().then(setSources).catch(() => undefined);
    fetchEmployees().then(setEmployees).catch(() => undefined);
  }, [open]);

  const sourceOptions: ComboboxOption[] = sources.map((source) => ({
    value: source.id,
    label: source.name,
  }));

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function create({ keepOpen }: { keepOpen: boolean }) {
    const session = getSession();
    if (!session?.access_token) return;
    if (!form.clientName.trim() || !form.phone.trim()) {
      setError('Client name and phone are required.');
      return;
    }

    if (!isValidIndianMobile(parseNationalDigits(form.phone))) {
      setError('Please match the requested format.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { data } = await apiFetch<Inquiry>('/api/v1/inquiries', {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({
          client_name: form.clientName.trim(),
          phone: toE164(parseNationalDigits(form.phone)),
          source_id: form.sourceId || undefined,
          source_name: !form.sourceId && form.sourceName.trim() ? form.sourceName.trim() : undefined,
          assigned_employee_id: form.assignedEmployeeId || undefined,
        }),
      });
      onCreated(data, { openDetail: !keepOpen });
      reset();
      if (!keepOpen) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDrawer
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Quick add lead"
      description="Capture a lead in under 30 seconds. Add more qualification details later."
      onSubmit={() => create({ keepOpen: false })}
      submitting={saving}
      error={error}
      submitLabel="Create lead"
      secondaryActionLabel="Create & add another"
      onSecondaryAction={() => create({ keepOpen: true })}
    >
      <FormSection compact>
        <FormField label="Client name" required full>
          <input
            value={form.clientName}
            onChange={(e) => setField('clientName', e.target.value)}
            required
            className="input"
            placeholder="Full name"
          />
        </FormField>
        <FormField label="Phone" required full>
          <PhoneInput value={form.phone} onChange={(value) => setField('phone', value)} required />
        </FormField>
        <FormField label="Lead source" full>
          <Combobox
            value={form.sourceId}
            onChange={(value) => setField('sourceId', value)}
            options={sourceOptions}
            freeText={form.sourceName}
            onFreeTextChange={(value) => setField('sourceName', value)}
            allowCustom
            placeholder="Select or add a source"
          />
        </FormField>
        <FormField label="Assign to" full hint="Leave unassigned if a manager will triage later.">
          <select
            value={form.assignedEmployeeId}
            onChange={(e) => setField('assignedEmployeeId', e.target.value)}
            className="input"
          >
            <option value="">Unassigned</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employeeLabel(employee)}
              </option>
            ))}
          </select>
        </FormField>
      </FormSection>
    </FormDrawer>
  );
}
