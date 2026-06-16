'use client';

import Link from 'next/link';
import { FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';

import { ActionGuard } from '../../../components/shared/ActionGuard';
import { apiFetch } from '../../../lib/api';
import { getSession } from '../../../lib/auth';
import {
  budgetLabel,
  humanize,
  INQUIRY_PRIORITIES,
  INQUIRY_STAGES,
  INQUIRY_TEMPERATURES,
  priorityBadgeClass,
  stageBadgeClass,
  stageLabel,
  temperatureBadgeClass,
  type Inquiry,
  type LeadSource,
  type ListMeta,
} from '../../../lib/crm';
import {
  employeeLabel,
  fetchEmployees,
  fetchLeadSources,
  fetchProperties,
  type EmployeeOption,
  type PropertyOption,
} from '../../../lib/crm-api';

export default function InquiriesPage() {
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [sources, setSources] = useState<LeadSource[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);

  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [priority, setPriority] = useState('');
  const [temperature, setTemperature] = useState('');
  const [source, setSource] = useState('');
  const [assignedEmployee, setAssignedEmployee] = useState('');
  const [property, setProperty] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [quickFilterVersion, setQuickFilterVersion] = useState(0);

  useEffect(() => {
    fetchLeadSources().then(setSources).catch(() => undefined);
    fetchEmployees().then(setEmployees).catch(() => undefined);
    fetchProperties().then(setProperties).catch(() => undefined);
  }, []);

  const load = useCallback(
    (page = 1) => {
      const session = getSession();
      if (!session?.access_token) return;

      const params = new URLSearchParams({
        page: String(page),
        per_page: '20',
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      if (search.trim()) params.set('search', search.trim());
      if (stage) params.set('filter[stage]', stage);
      if (priority) params.set('filter[priority]', priority);
      if (temperature) params.set('filter[temperature]', temperature);
      if (source) params.set('filter[source]', source);
      if (assignedEmployee) params.set('filter[assigned_employee]', assignedEmployee);
      if (property) params.set('filter[property]', property);
      if (dateFrom) params.set('filter[date_from]', dateFrom);
      if (dateTo) params.set('filter[date_to]', dateTo);

      setLoading(true);
      setError(null);
      apiFetch<Inquiry[]>(`/api/v1/inquiries?${params.toString()}`, {
        token: session.access_token,
      })
        .then((res) => {
          setRows(res.data);
          setMeta(res.meta as unknown as ListMeta);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load inquiries'))
        .finally(() => setLoading(false));
    },
    [search, stage, priority, temperature, source, assignedEmployee, property, dateFrom, dateTo, sortBy, sortDir],
  );

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortDir]);

  useEffect(() => {
    if (quickFilterVersion > 0) load(1);
  }, [load, quickFilterVersion]);

  function onFilter(e: FormEvent) {
    e.preventDefault();
    load(1);
  }

  function resetFilters() {
    setSearch('');
    setStage('');
    setPriority('');
    setTemperature('');
    setSource('');
    setAssignedEmployee('');
    setProperty('');
    setDateFrom('');
    setDateTo('');
  }

  const total = meta?.total ?? rows.length;
  const hot = rows.filter((row) => row.temperature === 'hot').length;
  const unassigned = rows.filter((row) => !row.assigned_employee_id).length;
  const staleNew = rows.filter((row) => row.stage === 'NEW' && leadAgeHours(row.created_at) >= 24).length;
  const qualified = rows.filter((row) => ['QUALIFIED', 'SITE_VISIT_SCHEDULED', 'SITE_VISIT_COMPLETED', 'NEGOTIATION'].includes(row.stage)).length;
  const won = rows.filter((row) => row.stage === 'CLOSED_WON' || row.stage === 'BOOKED').length;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-teal-100 bg-white shadow-card">
        <div className="grid gap-6 bg-gradient-to-br from-slate-950 via-teal-950 to-slate-900 p-6 text-white lg:grid-cols-[1.4fr_1fr] lg:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-200">CRM command center</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Inquiries</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
              Track buyer intent, ownership, temperature, budget, and the next pipeline move from one sales-ready view.
            </p>
          </div>
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <p className="text-sm text-slate-200">
              High-trust CRM demos need believable leads, clear assignment, and visible urgency.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/pipeline" className="inline-flex items-center justify-center rounded-xl border border-white/20 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10">
                Pipeline board
              </Link>
              <ActionGuard permission="crm.inquiries.create" featureFlag="crm">
                <Link href="/inquiries/new" className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-bold text-teal-900 shadow-card transition hover:bg-teal-50">
                  New inquiry
                </Link>
              </ActionGuard>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CrmMetric label="Total leads" value={total.toLocaleString('en-IN')} detail="role-scoped pipeline" />
        <CrmMetric label="Hot leads" value={hot.toLocaleString('en-IN')} detail="needs same-day attention" tone="rose" />
        <CrmMetric label="Unassigned" value={unassigned.toLocaleString('en-IN')} detail="no one owns these leads yet" tone={unassigned ? 'rose' : 'green'} />
        <CrmMetric label="Stale new" value={staleNew.toLocaleString('en-IN')} detail="new for 24h+ without progress" tone={staleNew ? 'rose' : 'green'} />
      </section>

      <LeadOwnershipPanel
        unassigned={unassigned}
        staleNew={staleNew}
        qualified={qualified}
        won={won}
        onUnassigned={() => {
          setAssignedEmployee('unassigned');
          setStage('');
          setDateTo('');
          setSortBy('created_at');
          setSortDir('asc');
          setQuickFilterVersion((version) => version + 1);
        }}
        onStaleNew={() => {
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
          setStage('NEW');
          setDateTo(yesterday.toISOString().slice(0, 10));
          setAssignedEmployee('');
          setSortBy('created_at');
          setSortDir('asc');
          setQuickFilterVersion((version) => version + 1);
        }}
      />

      <form onSubmit={onFilter} className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Find the right lead</h2>
            <p className="mt-1 text-xs text-slate-500">Filter by urgency, pipeline stage, source, assignee, property, and date range.</p>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Apply filters</button>
            <button type="button" onClick={resetFilters} className="btn-secondary">Reset</button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <FilterField label="Search" className="md:col-span-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="input" placeholder="Search name, phone, email, code" />
          </FilterField>
          <FilterField label="Stage">
            <select value={stage} onChange={(e) => setStage(e.target.value)} className="input">
              <option value="">All stages</option>
              {INQUIRY_STAGES.map((s) => (
                <option key={s} value={s}>{stageLabel(s)}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input">
              <option value="">All priorities</option>
              {INQUIRY_PRIORITIES.map((p) => (
                <option key={p} value={p}>{humanize(p)}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Temperature">
            <select value={temperature} onChange={(e) => setTemperature(e.target.value)} className="input">
              <option value="">All temperatures</option>
              {INQUIRY_TEMPERATURES.map((t) => (
                <option key={t} value={t}>{humanize(t)}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Source">
            <select value={source} onChange={(e) => setSource(e.target.value)} className="input">
              <option value="">All sources</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Assignee">
            <select value={assignedEmployee} onChange={(e) => setAssignedEmployee(e.target.value)} className="input">
              <option value="">All assignees</option>
              <option value="unassigned">Unassigned</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{employeeLabel(e)}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Property">
            <select value={property} onChange={(e) => setProperty(e.target.value)} className="input">
              <option value="">All properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="From">
            <input value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} type="date" className="input" />
          </FilterField>
          <FilterField label="To">
            <input value={dateTo} onChange={(e) => setDateTo(e.target.value)} type="date" className="input" />
          </FilterField>
        </div>
      </form>

      {loading ? <CrmLoadingState /> : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
          <span className="font-semibold">Could not load inquiries.</span> {error}
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? <EmptyInquiries /> : null}

      {!loading && !error && rows.length > 0 ? (
        <>
          {/* Cards: all rows on mobile/tablet (table is hidden there); featured 6 on desktop. */}
          <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {rows.map((row, index) => (
              <div key={row.id} className={index >= 6 ? 'lg:hidden' : ''}>
                <InquiryCard inquiry={row} />
              </div>
            ))}
          </section>

          <section className="hidden overflow-hidden rounded-2xl border border-reos-border bg-white shadow-card lg:block">
            <div className="flex items-center justify-between border-b border-reos-border px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Pipeline table</h2>
                <p className="mt-1 text-xs text-slate-500">Dense CRM view for qualification, assignment, and stage review.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-bold">Lead</th>
                    <th className="px-5 py-3 font-bold">Stage</th>
                    <th className="px-5 py-3 font-bold">Priority</th>
                    <th className="px-5 py-3 font-bold">Temperature</th>
                    <th className="px-5 py-3 font-bold">Budget</th>
                    <th className="px-5 py-3 font-bold">Source</th>
                    <th className="px-5 py-3 font-bold">Assignee</th>
                    <th className="px-5 py-3 font-bold">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-teal-50/40">
                      <td className="px-5 py-4">
                        <Link href={`/inquiries/${row.id}`} className="font-bold text-slate-900 hover:text-teal-800">
                          {row.client_name}
                        </Link>
                        <p className="mt-1 font-mono text-xs text-slate-500">{row.inquiry_code} · {row.phone}</p>
                      </td>
                      <td className="px-5 py-4"><StageBadge stage={row.stage} /></td>
                      <td className="px-5 py-4"><PriorityBadge priority={row.priority} /></td>
                      <td className="px-5 py-4"><TemperatureBadge temperature={row.temperature} /></td>
                      <td className="px-5 py-4 font-semibold tabular-nums text-slate-900">{budgetLabel(row.budget_min, row.budget_max)}</td>
                      <td className="px-5 py-4 text-slate-700">{row.source_name ?? 'Unknown'}</td>
                      <td className="px-5 py-4 text-slate-700">{row.assigned_employee_name ?? 'Unassigned'}</td>
                      <td className="px-5 py-4 text-slate-500">{new Date(row.created_at).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {meta ? (
        <div className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-slate-600">
          <span>Page {meta.page} of {meta.total_pages} · {meta.total} total</span>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Sort</span>
              <select
                value={`${sortBy}:${sortDir}`}
                onChange={(e) => {
                  const [b, d] = e.target.value.split(':');
                  setSortBy(b);
                  setSortDir(d as 'asc' | 'desc');
                }}
                className="input w-auto min-w-44 py-1.5"
              >
                <option value="created_at:desc">Newest</option>
                <option value="created_at:asc">Oldest</option>
                <option value="lead_score:desc">Lead score high to low</option>
                <option value="updated_at:desc">Recently updated</option>
              </select>
            </label>
            <div className="flex gap-2">
              <button type="button" disabled={meta.page <= 1} onClick={() => load(meta.page - 1)} className="btn-secondary px-3 py-1.5">
                Previous
              </button>
              <button type="button" disabled={meta.page >= meta.total_pages} onClick={() => load(meta.page + 1)} className="btn-secondary px-3 py-1.5">
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function leadAgeHours(createdAt: string): number {
  return (Date.now() - new Date(createdAt).getTime()) / (60 * 60 * 1000);
}

function FilterField({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function CrmMetric({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'default' | 'teal' | 'green' | 'rose';
}) {
  const toneClass =
    tone === 'teal'
      ? 'from-white to-teal-50 text-teal-800'
      : tone === 'green'
        ? 'from-white to-emerald-50 text-emerald-800'
        : tone === 'rose'
          ? 'from-white to-rose-50 text-rose-800'
          : 'from-white to-slate-50 text-slate-950';

  return (
    <div className={`rounded-2xl border border-reos-border bg-gradient-to-br p-5 shadow-card ${toneClass}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function LeadOwnershipPanel({
  unassigned,
  staleNew,
  qualified,
  won,
  onUnassigned,
  onStaleNew,
}: {
  unassigned: number;
  staleNew: number;
  qualified: number;
  won: number;
  onUnassigned: () => void;
  onStaleNew: () => void;
}) {
  const atRisk = unassigned + staleNew;
  return (
    <section className={`rounded-3xl border p-5 shadow-card ${atRisk ? 'border-rose-200 bg-rose-50' : 'border-teal-100 bg-teal-50'}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className={`text-xs font-bold uppercase tracking-[0.18em] ${atRisk ? 'text-rose-700' : 'text-teal-700'}`}>Lead ownership</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
            {atRisk ? 'Some leads need manager attention' : 'Every visible lead has a healthy owner path'}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Launch agencies cannot afford missed website leads. Keep unassigned leads at zero and move new leads to contacted within 24 hours.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onUnassigned} className="btn-secondary">
            Show unassigned
          </button>
          <button type="button" onClick={onStaleNew} className="btn-secondary">
            Show stale new
          </button>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <OwnershipStat label="Unassigned" value={unassigned} danger={unassigned > 0} />
        <OwnershipStat label="Stale new" value={staleNew} danger={staleNew > 0} />
        <OwnershipStat label="Qualified" value={qualified} />
        <OwnershipStat label="Won/booked" value={won} />
      </div>
    </section>
  );
}

function OwnershipStat({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${danger ? 'text-rose-700' : 'text-slate-950'}`}>{value.toLocaleString('en-IN')}</p>
    </div>
  );
}

function InquiryCard({ inquiry }: { inquiry: Inquiry }) {
  return (
    <Link href={`/inquiries/${inquiry.id}`} className="group rounded-3xl border border-reos-border bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-raised">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-slate-400">{inquiry.inquiry_code}</p>
          <h3 className="mt-2 text-lg font-bold text-slate-950 group-hover:text-teal-800">{inquiry.client_name}</h3>
          <p className="mt-1 text-sm text-slate-500">{inquiry.phone}</p>
        </div>
        <LeadScore score={inquiry.lead_score} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <StageBadge stage={inquiry.stage} />
        <TemperatureBadge temperature={inquiry.temperature} />
        <PriorityBadge priority={inquiry.priority} />
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
        <InfoRow label="Budget" value={budgetLabel(inquiry.budget_min, inquiry.budget_max)} />
        <InfoRow label="Need" value={[inquiry.requirement_type, inquiry.property_type, inquiry.preferred_location].filter(Boolean).map((v) => humanize(String(v))).join(' · ') || 'Not captured'} />
        <InfoRow label="Owner" value={inquiry.assigned_employee_name ?? 'Unassigned'} />
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>{inquiry.source_name ?? 'Unknown source'}</span>
        <span>{new Date(inquiry.created_at).toLocaleDateString('en-IN')}</span>
      </div>
    </Link>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function LeadScore({ score }: { score: number | null }) {
  const display = score ?? 0;
  return (
    <div className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-teal-50 text-teal-800 shadow-sm">
      <span className="text-lg font-bold tabular-nums">{display}</span>
      <span className="text-[10px] font-bold uppercase tracking-wide">score</span>
    </div>
  );
}

function StageBadge({ stage }: { stage: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${stageBadgeClass(stage)}`}>{stageLabel(stage)}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${priorityBadgeClass(priority)}`}>{humanize(priority)}</span>;
}

function TemperatureBadge({ temperature }: { temperature: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${temperatureBadgeClass(temperature)}`}>{humanize(temperature)}</span>;
}

function CrmLoadingState() {
  return (
    <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-3xl border border-reos-border bg-white p-5 shadow-card">
          <div className="h-4 w-24 animate-pulse rounded-xl bg-slate-200" />
          <div className="mt-4 h-6 w-40 animate-pulse rounded-xl bg-slate-200" />
          <div className="mt-3 h-4 w-32 animate-pulse rounded-xl bg-slate-200" />
          <div className="mt-5 h-28 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      ))}
    </section>
  );
}

function EmptyInquiries() {
  return (
    <section className="rounded-3xl border border-dashed border-teal-200 bg-gradient-to-br from-teal-50 to-white p-10 text-center shadow-card">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-700">No leads found</p>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">Your pipeline is ready for demand.</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
        Capture website, WhatsApp, referral, and walk-in leads so the dashboard, pipeline, and follow-up engine have real activity.
      </p>
      <ActionGuard permission="crm.inquiries.create" featureFlag="crm">
        <Link href="/inquiries/new" className="btn-primary mt-6">
          Create first inquiry
        </Link>
      </ActionGuard>
    </section>
  );
}
