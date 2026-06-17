'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { ActionGuard } from '../../../components/shared/ActionGuard';
import {
  ActionMenu,
  CrudToolbar,
  DataTable,
  EmptyState,
  FilterDrawer,
  FilterField,
  Icon,
  Pagination,
  type DataTableColumn,
} from '../../../components/ui';
import { useTableQuery, type TableQueryValues } from '../../../hooks/use-table-query';
import { apiFetch } from '../../../lib/api';
import { getSession, hasPermission, type AuthSession } from '../../../lib/auth';
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
  type InquirySummary,
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
import { InquiryDetailDrawer } from './inquiry-detail-drawer';
import { QuickCreateInquiryDrawer } from './quick-create-inquiry-drawer';

const FILTER_KEYS = ['stage', 'priority', 'temperature', 'source', 'assigned_employee', 'property', 'date_from', 'date_to'];

export default function InquiriesPage() {
  return (
    <Suspense fallback={null}>
      <InquiriesInner />
    </Suspense>
  );
}

function InquiriesInner() {
  const query = useTableQuery({
    filterKeys: FILTER_KEYS,
    defaults: { sort_by: 'created_at', sort_dir: 'desc' },
  });

  const [rows, setRows] = useState<Inquiry[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [summary, setSummary] = useState<InquirySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TableQueryValues>(query.filters);
  const [session, setSession] = useState<AuthSession | null>(null);

  const [sources, setSources] = useState<LeadSource[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);

  useEffect(() => {
    setSession(getSession());
    fetchLeadSources().then(setSources).catch(() => undefined);
    fetchEmployees().then(setEmployees).catch(() => undefined);
    fetchProperties().then(setProperties).catch(() => undefined);
  }, []);

  const canUpdate = hasPermission(session, 'crm.inquiries.update');

  const { search, filters, sortBy, sortDir, page, setPage, perPage, setPerPage, commit } = query;
  const filtersKey = JSON.stringify(filters);

  const load = useCallback(() => {
    const active = getSession();
    if (!active?.access_token) return;

    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      sort_by: sortBy || 'created_at',
      sort_dir: sortDir || 'desc',
    });
    if (search.trim()) params.set('search', search.trim());
    const f = JSON.parse(filtersKey) as TableQueryValues;
    if (f.stage) params.set('filter[stage]', f.stage);
    if (f.priority) params.set('filter[priority]', f.priority);
    if (f.temperature) params.set('filter[temperature]', f.temperature);
    if (f.source) params.set('filter[source]', f.source);
    if (f.assigned_employee) params.set('filter[assigned_employee]', f.assigned_employee);
    if (f.property) params.set('filter[property]', f.property);
    if (f.date_from) params.set('filter[date_from]', f.date_from);
    if (f.date_to) params.set('filter[date_to]', f.date_to);

    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch<Inquiry[]>(`/api/v1/inquiries?${params.toString()}`, { token: active.access_token }),
      apiFetch<InquirySummary>(`/api/v1/inquiries/summary?${params.toString()}`, { token: active.access_token }),
    ])
      .then(([listRes, summaryRes]) => {
        setRows(listRes.data);
        setMeta(listRes.meta as unknown as ListMeta);
        setSummary(summaryRes.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load inquiries'))
      .finally(() => setLoading(false));
  }, [page, perPage, sortBy, sortDir, search, filtersKey]);

  useEffect(() => {
    load();
  }, [load]);

  function openFilter() {
    setDraft(filters);
    setFilterOpen(true);
  }

  const total = summary?.total ?? meta?.total ?? rows.length;
  const hot = summary?.hot ?? 0;
  const unassigned = summary?.unassigned ?? 0;
  const staleNew = summary?.stale_new ?? 0;
  const qualified = summary?.qualified ?? 0;
  const won = (summary?.won ?? 0) + (summary?.booked ?? 0);

  const columns: DataTableColumn<Inquiry>[] = [
    {
      key: 'lead',
      header: 'Lead',
      render: (row) => (
        <div>
          <button
            type="button"
            onClick={() => setSelectedInquiryId(row.id)}
            className="font-semibold text-slate-900 hover:text-teal-800"
          >
            {row.client_name}
          </button>
          <p className="mt-0.5 font-mono text-2xs text-slate-500">
            {row.inquiry_code} · {row.phone}
          </p>
        </div>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      render: (row) => (
        <span className={`rounded-full px-2.5 py-1 text-2xs font-bold ${stageBadgeClass(row.stage)}`}>{stageLabel(row.stage)}</span>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (row) => (
        <span className={`rounded-full px-2.5 py-1 text-2xs font-bold ${priorityBadgeClass(row.priority)}`}>{humanize(row.priority)}</span>
      ),
    },
    {
      key: 'temperature',
      header: 'Temperature',
      render: (row) => (
        <span className={`rounded-full px-2.5 py-1 text-2xs font-bold ${temperatureBadgeClass(row.temperature)}`}>{humanize(row.temperature)}</span>
      ),
    },
    {
      key: 'budget',
      header: 'Budget',
      align: 'right',
      cellClassName: 'font-semibold tabular-nums text-slate-900',
      render: (row) => budgetLabel(row.budget_min, row.budget_max),
    },
    { key: 'source', header: 'Source', render: (row) => <span className="text-slate-700">{row.source_name ?? 'Unknown'}</span> },
    { key: 'assignee', header: 'Assignee', render: (row) => <span className="text-slate-700">{row.assigned_employee_name ?? 'Unassigned'}</span> },
    {
      key: 'created',
      header: 'Created',
      cellClassName: 'text-slate-500',
      render: (row) => new Date(row.created_at).toLocaleDateString('en-IN'),
    },
  ];

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
                <button
                  type="button"
                  onClick={() => setQuickCreateOpen(true)}
                  className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-bold text-teal-900 shadow-card transition hover:bg-teal-50"
                >
                  Quick add lead
                </button>
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
        onUnassigned={() =>
          commit({ assigned_employee: 'unassigned', stage: '', date_to: '', sort_by: 'created_at', sort_dir: 'asc' })
        }
        onStaleNew={() => {
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
          commit({ stage: 'NEW', date_to: yesterday.toISOString().slice(0, 10), assigned_employee: '', sort_by: 'created_at', sort_dir: 'asc' });
        }}
      />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
          <span className="font-semibold">Could not load inquiries.</span> {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-reos-border bg-white shadow-card">
        <CrudToolbar
          searchValue={query.searchInput}
          onSearchChange={query.setSearchInput}
          searchPlaceholder="Search name, phone, email, code"
          controlSlot={
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span className="text-2xs font-bold uppercase tracking-wide text-slate-500">Sort</span>
              <select
                value={`${sortBy || 'created_at'}:${sortDir || 'desc'}`}
                onChange={(e) => {
                  const [b, d] = e.target.value.split(':');
                  query.setSort(b, d);
                }}
                className="input w-auto min-w-44 py-1.5"
              >
                <option value="created_at:desc">Newest</option>
                <option value="created_at:asc">Oldest</option>
                <option value="lead_score:desc">Lead score high to low</option>
                <option value="updated_at:desc">Recently updated</option>
              </select>
            </label>
          }
          onFilter={openFilter}
          filterCount={query.activeFilterCount}
          onRefresh={load}
          refreshing={loading}
          addSlot={
            <ActionGuard permission="crm.inquiries.create" featureFlag="crm">
              <button type="button" className="btn-primary" onClick={() => setQuickCreateOpen(true)}>
                <Icon name="plus" className="h-4 w-4" /> Quick add lead
              </button>
            </ActionGuard>
          }
        />

        <DataTable<Inquiry>
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          onRowClick={(row) => setSelectedInquiryId(row.id)}
          loading={loading}
          loadingRows={Math.min(perPage, 12)}
          empty={
            <EmptyState
              title="No leads match your filters"
              description="Adjust filters or capture website, WhatsApp, referral, and walk-in leads to fill the pipeline."
              action={
                <ActionGuard permission="crm.inquiries.create" featureFlag="crm">
                  <button type="button" className="btn-primary" onClick={() => setQuickCreateOpen(true)}>
                    Create first inquiry
                  </button>
                </ActionGuard>
              }
            />
          }
          actions={(row) => (
            <ActionMenu
              items={[
                { label: 'Quick view', onSelect: () => setSelectedInquiryId(row.id) },
                { label: 'Open full page', href: `/inquiries/${row.id}` },
                { label: 'Edit', href: `/inquiries/${row.id}/edit`, hidden: !canUpdate },
              ]}
            />
          )}
        />

        {meta ? (
          <Pagination
            page={meta.page}
            totalPages={meta.total_pages}
            total={meta.total}
            perPage={perPage}
            onPageChange={setPage}
            onPerPageChange={setPerPage}
          />
        ) : null}
      </section>

      <FilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={() => query.applyFilters(draft)}
        onClear={() => {
          query.clearFilters();
          setDraft(Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])));
        }}
      >
        <FilterField label="Stage">
          <select value={draft.stage ?? ''} onChange={(e) => setDraft((d) => ({ ...d, stage: e.target.value }))} className="input">
            <option value="">All stages</option>
            {INQUIRY_STAGES.map((s) => (
              <option key={s} value={s}>{stageLabel(s)}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Priority">
          <select value={draft.priority ?? ''} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))} className="input">
            <option value="">All priorities</option>
            {INQUIRY_PRIORITIES.map((p) => (
              <option key={p} value={p}>{humanize(p)}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Temperature">
          <select value={draft.temperature ?? ''} onChange={(e) => setDraft((d) => ({ ...d, temperature: e.target.value }))} className="input">
            <option value="">All temperatures</option>
            {INQUIRY_TEMPERATURES.map((t) => (
              <option key={t} value={t}>{humanize(t)}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Source">
          <select value={draft.source ?? ''} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))} className="input">
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Assignee">
          <select value={draft.assigned_employee ?? ''} onChange={(e) => setDraft((d) => ({ ...d, assigned_employee: e.target.value }))} className="input">
            <option value="">All assignees</option>
            <option value="unassigned">Unassigned</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{employeeLabel(e)}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Property">
          <select value={draft.property ?? ''} onChange={(e) => setDraft((d) => ({ ...d, property: e.target.value }))} className="input">
            <option value="">All properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </FilterField>
        <div className="grid grid-cols-2 gap-3">
          <FilterField label="From">
            <input value={draft.date_from ?? ''} onChange={(e) => setDraft((d) => ({ ...d, date_from: e.target.value }))} type="date" className="input" />
          </FilterField>
          <FilterField label="To">
            <input value={draft.date_to ?? ''} onChange={(e) => setDraft((d) => ({ ...d, date_to: e.target.value }))} type="date" className="input" />
          </FilterField>
        </div>
      </FilterDrawer>

      <QuickCreateInquiryDrawer
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        onCreated={(inquiry, options) => {
          if (options.openDetail) setSelectedInquiryId(inquiry.id);
          load();
        }}
      />
      <InquiryDetailDrawer inquiryId={selectedInquiryId} onClose={() => setSelectedInquiryId(null)} />
    </div>
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
