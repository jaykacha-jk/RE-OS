'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { apiFetch } from '../../../lib/api';
import { getSession } from '../../../lib/auth';
import {
  humanize,
  INQUIRY_PRIORITIES,
  INQUIRY_PROPERTY_TYPES,
  INQUIRY_PURCHASE_TIMELINES,
  INQUIRY_REQUIREMENT_TYPES,
  INQUIRY_TEMPERATURES,
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

type Mode = 'create' | 'edit';

const inputClass = 'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm';
const labelClass = 'block text-sm font-medium text-slate-700';

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

  useEffect(() => {
    fetchEmployees().then(setEmployees).catch(() => undefined);
    fetchProperties().then(setProperties).catch(() => undefined);
    fetchLeadSources().then(setSources).catch(() => undefined);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const session = getSession();
    if (!session?.access_token) return;

    const body: Record<string, unknown> = {
      client_name: clientName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      whatsapp: whatsapp.trim() || undefined,
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
        router.push(`/inquiries/${res.data.id}`);
      } else if (inquiry) {
        await apiFetch<Inquiry>(`/api/v1/inquiries/${inquiry.id}`, {
          method: 'PATCH',
          token: session.access_token,
          body: JSON.stringify(body),
        });
        router.push(`/inquiries/${inquiry.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-8">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Lead</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Client name *</label>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Phone *</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>WhatsApp</label>
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inputClass} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Source &amp; assignment</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Lead source</label>
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={inputClass}>
              <option value="">— select —</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Or free-text source</label>
            <input
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              disabled={!!sourceId}
              placeholder="e.g. Walk-in"
              className={`${inputClass} disabled:bg-slate-100`}
            />
          </div>
          <div>
            <label className={labelClass}>Linked property</label>
            <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className={inputClass}>
              <option value="">— none —</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          {mode === 'create' ? (
            <div>
              <label className={labelClass}>Assign to</label>
              <select value={assignedEmployeeId} onChange={(e) => setAssignedEmployeeId(e.target.value)} className={inputClass}>
                <option value="">— unassigned —</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{employeeLabel(emp)}</option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Requirements</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <div>
            <label className={labelClass}>Requirement type</label>
            <select value={requirementType} onChange={(e) => setRequirementType(e.target.value)} className={inputClass}>
              <option value="">—</option>
              {INQUIRY_REQUIREMENT_TYPES.map((t) => (
                <option key={t} value={t}>{humanize(t)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Property type</label>
            <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className={inputClass}>
              <option value="">—</option>
              {INQUIRY_PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>{humanize(t)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Bedrooms</label>
            <input value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} type="number" min="0" className={inputClass} />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Preferred location</label>
            <input value={preferredLocation} onChange={(e) => setPreferredLocation(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Purchase timeline</label>
            <select value={purchaseTimeline} onChange={(e) => setPurchaseTimeline(e.target.value)} className={inputClass}>
              <option value="">—</option>
              {INQUIRY_PURCHASE_TIMELINES.map((t) => (
                <option key={t} value={t}>{humanize(t)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Budget min (₹)</label>
            <input value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} type="number" min="0" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Budget max (₹)</label>
            <input value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} type="number" min="0" className={inputClass} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Scoring</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <div>
            <label className={labelClass}>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}>
              {INQUIRY_PRIORITIES.map((p) => (
                <option key={p} value={p}>{humanize(p)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Temperature</label>
            <select value={temperature} onChange={(e) => setTemperature(e.target.value)} className={inputClass}>
              {INQUIRY_TEMPERATURES.map((t) => (
                <option key={t} value={t}>{humanize(t)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Lead score (0–100)</label>
            <input value={leadScore} onChange={(e) => setLeadScore(e.target.value)} type="number" min="0" max="100" className={inputClass} />
          </div>
          <div className="md:col-span-3">
            <label className={labelClass}>Remarks</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} className={inputClass} />
          </div>
        </div>
      </section>

      {error ? <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {mode === 'create' ? (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={overrideDuplicate} onChange={(e) => setOverrideDuplicate(e.target.checked)} />
          Override duplicate detection (same phone within 30 days)
        </label>
      ) : null}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {saving ? 'Saving…' : mode === 'create' ? 'Create inquiry' : 'Save changes'}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded border border-slate-300 px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
