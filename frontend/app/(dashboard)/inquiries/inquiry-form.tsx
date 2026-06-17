'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Combobox, FormField, FormPage, FormSection, PhoneInput, type ComboboxOption } from '../../../components/ui';
import { useUnsavedChangesGuard } from '../../../hooks/use-unsaved-changes-guard';
import { apiFetch } from '../../../lib/api';
import { getSession } from '../../../lib/auth';
import {
  humanize,
  INQUIRY_PRIORITIES,
  INQUIRY_PROPERTY_TYPES,
  INQUIRY_PURCHASE_TIMELINES,
  INQUIRY_REQUIREMENT_TYPES,
  INQUIRY_TEMPERATURES,
  stageBadgeClass,
  stageLabel,
  type Inquiry,
  type LeadSource,
} from '../../../lib/crm';
import {
  employeeLabel,
  fetchEmployees,
  fetchLeadSources,
  fetchProperties,
  type EmployeeOption,
  type PropertyOption,
} from '../../../lib/crm-api';
import { isValidIndianMobile, parseNationalDigits, toE164 } from '../../../lib/phone';

type Mode = 'create' | 'edit';

export function InquiryForm({ mode, inquiry }: { mode: Mode; inquiry?: Inquiry }) {
  const router = useRouter();

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);

  const [clientName, setClientName] = useState(inquiry?.client_name ?? '');
  const [phone, setPhone] = useState(inquiry?.phone ?? '');
  const [email, setEmail] = useState(inquiry?.email ?? '');
  const [whatsapp, setWhatsapp] = useState(inquiry?.whatsapp ?? '');
  const [propertyId, setPropertyId] = useState(inquiry?.property_id ?? '');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState(inquiry?.assigned_employee_id ?? '');
  const [sourceId, setSourceId] = useState(inquiry?.source_id ?? '');
  const [sourceName, setSourceName] = useState(inquiry?.source_id ? '' : inquiry?.source_name ?? '');
  const [budgetMin, setBudgetMin] = useState(inquiry?.budget_min != null ? String(inquiry.budget_min) : '');
  const [budgetMax, setBudgetMax] = useState(inquiry?.budget_max != null ? String(inquiry.budget_max) : '');
  const [requirementType, setRequirementType] = useState(inquiry?.requirement_type ?? '');
  const [propertyType, setPropertyType] = useState(inquiry?.property_type ?? '');
  const [preferredLocation, setPreferredLocation] = useState(inquiry?.preferred_location ?? '');
  const [bedrooms, setBedrooms] = useState(inquiry?.bedrooms != null ? String(inquiry.bedrooms) : '');
  const [purchaseTimeline, setPurchaseTimeline] = useState(inquiry?.purchase_timeline ?? '');
  const [priority, setPriority] = useState(inquiry?.priority ?? 'medium');
  const [temperature, setTemperature] = useState(inquiry?.temperature ?? 'warm');
  const [leadScore, setLeadScore] = useState(inquiry?.lead_score != null ? String(inquiry.lead_score) : '');
  const [remarks, setRemarks] = useState(inquiry?.remarks ?? '');
  const [overrideDuplicate, setOverrideDuplicate] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useUnsavedChangesGuard(dirty && !saving);

  useEffect(() => {
    fetchEmployees().then(setEmployees).catch(() => undefined);
    fetchProperties().then(setProperties).catch(() => undefined);
    fetchLeadSources().then(setSources).catch(() => undefined);
  }, []);

  function mark<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  const sourceOptions: ComboboxOption[] = sources.map((s) => ({ value: s.id, label: s.name }));
  const propertyOptions: ComboboxOption[] = properties.map((p) => ({ value: p.id, label: p.title }));

  async function submit() {
    const session = getSession();
    if (!session?.access_token) return;

    if (!isValidIndianMobile(parseNationalDigits(phone))) {
      setError('Please match the requested format.');
      return;
    }
    if (whatsapp.trim() && !isValidIndianMobile(parseNationalDigits(whatsapp))) {
      setError('Please match the requested format.');
      return;
    }

    const body: Record<string, unknown> = {
      client_name: clientName.trim(),
      phone: toE164(parseNationalDigits(phone)),
      email: email.trim() || undefined,
      whatsapp: whatsapp.trim() ? toE164(parseNationalDigits(whatsapp)) : undefined,
      property_id: propertyId || undefined,
      source_id: sourceId || undefined,
      source_name: !sourceId && sourceName.trim() ? sourceName.trim() : undefined,
      budget_min: budgetMin ? Number(budgetMin) : undefined,
      budget_max: budgetMax ? Number(budgetMax) : undefined,
      requirement_type: requirementType || undefined,
      property_type: propertyType || undefined,
      preferred_location: preferredLocation.trim() || undefined,
      bedrooms: bedrooms ? Number(bedrooms) : undefined,
      purchase_timeline: purchaseTimeline || undefined,
      priority,
      temperature,
      lead_score: leadScore ? Number(leadScore) : undefined,
      remarks: remarks.trim() || undefined,
    };

    if (mode === 'create') {
      body.assigned_employee_id = assignedEmployeeId || undefined;
      if (overrideDuplicate) body.override_duplicate = true;
    }

    setSaving(true);
    setError(null);
    try {
      if (mode === 'create') {
        const res = await apiFetch<Inquiry>('/api/v1/inquiries', {
          method: 'POST',
          token: session.access_token,
          body: JSON.stringify(body),
        });
        setDirty(false);
        router.push(`/inquiries/${res.data.id}`);
      } else if (inquiry) {
        await apiFetch<Inquiry>(`/api/v1/inquiries/${inquiry.id}`, {
          method: 'PATCH',
          token: session.access_token,
          body: JSON.stringify(body),
        });
        setDirty(false);
        router.push(`/inquiries/${inquiry.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const currentStage = inquiry?.stage ?? 'NEW';

  return (
    <FormPage
      eyebrow={mode === 'create' ? 'New lead' : 'Edit lead'}
      title={mode === 'create' ? 'New inquiry' : inquiry?.client_name ?? 'Edit inquiry'}
      description={
        mode === 'create'
          ? 'A unique inquiry code is generated automatically. New leads start in the NEW stage.'
          : 'Update lead details. Use Change stage and Assign from the inquiry page to manage pipeline and ownership.'
      }
      breadcrumbs={[
        { label: 'Inquiries', href: '/inquiries' },
        { label: mode === 'create' ? 'New inquiry' : 'Edit' },
      ]}
      statusBadge={
        <span className={`rounded-full px-2.5 py-1 text-2xs font-bold ${stageBadgeClass(currentStage)}`}>
          {stageLabel(currentStage)}
        </span>
      }
      error={error}
      submitting={saving}
      submitLabel={mode === 'create' ? 'Create inquiry' : 'Save changes'}
      onSubmit={submit}
      onCancel={() => router.back()}
    >
      <FormSection title="Lead" description="Who reached out. Name and phone are all you need to capture a lead fast.">
        <FormField label="Client name" required>
          <input value={clientName} onChange={(e) => mark(setClientName)(e.target.value)} required className="input" placeholder="Full name" />
        </FormField>
        <FormField label="Phone" required>
          <PhoneInput value={phone} onChange={mark(setPhone)} required />
        </FormField>
        <FormField label="Email">
          <input value={email} onChange={(e) => mark(setEmail)(e.target.value)} type="email" className="input" placeholder="name@example.com" />
        </FormField>
        <FormField label="WhatsApp" hint="Leave blank to reuse the phone number.">
          <PhoneInput value={whatsapp} onChange={mark(setWhatsapp)} />
        </FormField>
      </FormSection>

      <FormSection title="Source & assignment" description="Where the lead came from and who owns it.">
        <FormField label="Lead source" hint="Pick an existing source or type a new one.">
          <Combobox
            value={sourceId}
            onChange={mark(setSourceId)}
            options={sourceOptions}
            freeText={sourceName}
            onFreeTextChange={mark(setSourceName)}
            allowCustom
            placeholder="Select or add a source"
          />
        </FormField>
        <FormField label="Linked property" hint="Optional — the property this lead is interested in.">
          <Combobox
            value={propertyId}
            onChange={mark(setPropertyId)}
            options={propertyOptions}
            placeholder="— none —"
          />
        </FormField>
        {mode === 'create' ? (
          <FormField label="Assign to" full hint="Leave unassigned to triage from the pipeline later.">
            <select value={assignedEmployeeId} onChange={(e) => mark(setAssignedEmployeeId)(e.target.value)} className="input">
              <option value="">— Unassigned —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{employeeLabel(emp)}</option>
              ))}
            </select>
          </FormField>
        ) : null}
      </FormSection>

      <FormSection
        title="Requirements"
        description="What the buyer is looking for. Helps matching and prioritisation."
        collapsible
        defaultOpen={mode === 'edit'}
      >
        <FormField label="Requirement type">
          <select value={requirementType} onChange={(e) => mark(setRequirementType)(e.target.value)} className="input">
            <option value="">—</option>
            {INQUIRY_REQUIREMENT_TYPES.map((t) => (
              <option key={t} value={t}>{humanize(t)}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Property type">
          <select value={propertyType} onChange={(e) => mark(setPropertyType)(e.target.value)} className="input">
            <option value="">—</option>
            {INQUIRY_PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>{humanize(t)}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Bedrooms">
          <input value={bedrooms} onChange={(e) => mark(setBedrooms)(e.target.value)} type="number" min="0" className="input" placeholder="3" />
        </FormField>
        <FormField label="Preferred location" full>
          <input value={preferredLocation} onChange={(e) => mark(setPreferredLocation)(e.target.value)} className="input" placeholder="e.g. Bandra West, Mumbai" />
        </FormField>
        <FormField label="Purchase timeline">
          <select value={purchaseTimeline} onChange={(e) => mark(setPurchaseTimeline)(e.target.value)} className="input">
            <option value="">—</option>
            {INQUIRY_PURCHASE_TIMELINES.map((t) => (
              <option key={t} value={t}>{humanize(t)}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Budget min (₹)">
          <input value={budgetMin} onChange={(e) => mark(setBudgetMin)(e.target.value)} type="number" min="0" className="input" placeholder="5000000" />
        </FormField>
        <FormField label="Budget max (₹)">
          <input value={budgetMax} onChange={(e) => mark(setBudgetMax)(e.target.value)} type="number" min="0" className="input" placeholder="9000000" />
        </FormField>
      </FormSection>

      <FormSection
        title="Scoring & notes"
        description="Prioritise the lead and capture context for the team."
        collapsible
        defaultOpen={mode === 'edit'}
      >
        <FormField label="Priority">
          <select value={priority} onChange={(e) => mark(setPriority)(e.target.value)} className="input">
            {INQUIRY_PRIORITIES.map((p) => (
              <option key={p} value={p}>{humanize(p)}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Temperature">
          <select value={temperature} onChange={(e) => mark(setTemperature)(e.target.value)} className="input">
            {INQUIRY_TEMPERATURES.map((t) => (
              <option key={t} value={t}>{humanize(t)}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Lead score" hint="0–100. Higher means more sales-ready.">
          <input value={leadScore} onChange={(e) => mark(setLeadScore)(e.target.value)} type="number" min="0" max="100" className="input" placeholder="60" />
        </FormField>
        <FormField label="Remarks" full>
          <textarea value={remarks} onChange={(e) => mark(setRemarks)(e.target.value)} rows={3} className="input" placeholder="Anything the team should know about this lead…" />
        </FormField>
      </FormSection>

      {mode === 'create' ? (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={overrideDuplicate}
            onChange={(e) => setOverrideDuplicate(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          Override duplicate detection (same phone within 30 days)
        </label>
      ) : null}
    </FormPage>
  );
}
