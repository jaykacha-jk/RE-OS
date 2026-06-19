'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  CrudToolbar,
  DataTable,
  Drawer,
  EmptyState,
  FilterDrawer,
  FilterField,
  PageHeader,
  Pagination,
  type DataTableColumn,
} from '../ui';
import { useTableQuery, type TableQueryValues } from '../../hooks/use-table-query';
import { apiFetch } from '../../lib/api';
import { getSession, hasPermission } from '../../lib/auth';
import { downloadAuditCsv } from '../../lib/settings';

export type AuditLogRow = {
  id: string;
  tenant_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: string;
};

type AuditMeta = {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
};

const TENANT_FILTER_KEYS = ['entity_type', 'actor_email', 'date_from', 'date_to'] as const;
const PLATFORM_FILTER_KEYS = [...TENANT_FILTER_KEYS, 'tenant_id'] as const;

export function AuditLogsView({ platformMode = false }: { platformMode?: boolean }) {
  const filterKeys = platformMode ? PLATFORM_FILTER_KEYS : TENANT_FILTER_KEYS;
  const query = useTableQuery({ filterKeys: [...filterKeys], searchKey: 'action' });
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [meta, setMeta] = useState<AuditMeta | null>(null);
  const [draft, setDraft] = useState<TableQueryValues>(query.filters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [detail, setDetail] = useState<AuditLogRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [canExport, setCanExport] = useState(false);

  useEffect(() => {
    setCanExport(hasPermission(getSession(), 'audit.logs.export'));
  }, []);

  const { search, filters, page, setPage, perPage, setPerPage } = query;
  const filtersKey = JSON.stringify(filters);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    const f = JSON.parse(filtersKey) as TableQueryValues;
    if (search.trim()) params.set('action', search.trim());
    if (f.entity_type?.trim()) params.set('entity_type', f.entity_type.trim());
    if (f.actor_email?.trim()) params.set('actor_email', f.actor_email.trim());
    if (f.tenant_id?.trim()) params.set('tenant_id', f.tenant_id.trim());
    if (f.date_from) params.set('date_from', new Date(f.date_from).toISOString());
    if (f.date_to) params.set('date_to', new Date(f.date_to).toISOString());
    return params;
  }, [page, perPage, search, filtersKey]);

  const load = useCallback(() => {
    const session = getSession();
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);
    apiFetch<AuditLogRow[]>(`/api/v1/audit-logs?${buildParams().toString()}`, {
      token: session.access_token,
    })
      .then((res) => {
        setRows(res.data);
        setMeta(res.meta as AuditMeta);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load audit logs'))
      .finally(() => setLoading(false));
  }, [buildParams]);

  useEffect(() => {
    load();
  }, [load]);

  async function onExport() {
    try {
      const params = buildParams();
      params.delete('page');
      params.delete('per_page');
      await downloadAuditCsv(params);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  }

  function openFilter() {
    setDraft(filters);
    setFilterOpen(true);
  }

  const columns: DataTableColumn<AuditLogRow>[] = [
    {
      key: 'time',
      header: 'Time',
      cellClassName: 'text-slate-600',
      render: (row) => new Date(row.created_at).toLocaleString(),
    },
    ...(platformMode
      ? [
          {
            key: 'tenant',
            header: 'Tenant',
            render: (row: AuditLogRow) => (
              <span className="font-mono text-2xs text-slate-600">{row.tenant_id ?? 'platform'}</span>
            ),
          } as DataTableColumn<AuditLogRow>,
        ]
      : []),
    {
      key: 'actor',
      header: 'Actor',
      render: (row) => <span className="text-slate-700">{row.actor_email ?? 'System'}</span>,
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => <span className="font-mono text-xs text-slate-800">{row.action}</span>,
    },
    {
      key: 'entity',
      header: 'Entity',
      render: (row) => <span className="text-slate-700">{row.entity_type ?? '—'}</span>,
    },
    {
      key: 'changes',
      header: 'Changes',
      render: (row) => (
        <span className="text-2xs text-slate-500">
          {row.before_state || row.after_state ? 'View details' : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Security"
        title={platformMode ? 'Platform audit logs' : 'Audit logs'}
        description={
          platformMode
            ? 'Cross-tenant activity trail for organizations, billing, plans, and platform actions.'
            : 'Tenant-scoped activity trail for auth, organization, employee, billing, and data changes.'
        }
      />

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-reos-border bg-white shadow-card">
        <CrudToolbar
          searchValue={query.searchInput}
          onSearchChange={query.setSearchInput}
          searchPlaceholder="Search action"
          onFilter={openFilter}
          filterCount={query.activeFilterCount}
          onExport={canExport ? onExport : undefined}
          onRefresh={load}
          refreshing={loading}
        />

        <DataTable<AuditLogRow>
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={loading}
          onRowClick={(row) => {
            if (row.before_state || row.after_state) setDetail(row);
          }}
          empty={
            <EmptyState
              title="No audit logs found"
              description="Try clearing filters or widening the date range."
            />
          }
        />

        {!loading && meta && meta.total > 0 ? (
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
        title="Filter audit logs"
        onApply={() => {
          query.applyFilters(draft);
          setFilterOpen(false);
        }}
        onClear={() => {
          query.clearFilters();
          setDraft(Object.fromEntries(filterKeys.map((k) => [k, ''])));
          setFilterOpen(false);
        }}
      >
        {platformMode ? (
          <FilterField label="Tenant ID">
            <input
              value={draft.tenant_id ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, tenant_id: e.target.value }))}
              className="input font-mono text-xs"
              placeholder="UUID — optional"
            />
          </FilterField>
        ) : null}
        <FilterField label="Entity type">
          <input
            value={draft.entity_type ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, entity_type: e.target.value }))}
            className="input"
            placeholder="employee, organization"
          />
        </FilterField>
        <FilterField label="Actor email">
          <input
            value={draft.actor_email ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, actor_email: e.target.value }))}
            className="input"
            placeholder="owner@example.com"
          />
        </FilterField>
        <div className="grid grid-cols-2 gap-3">
          <FilterField label="From">
            <input
              value={draft.date_from ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, date_from: e.target.value }))}
              type="date"
              className="input"
            />
          </FilterField>
          <FilterField label="To">
            <input
              value={draft.date_to ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, date_to: e.target.value }))}
              type="date"
              className="input"
            />
          </FilterField>
        </div>
      </FilterDrawer>

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Audit entry"
        description={detail ? `${detail.action} · ${new Date(detail.created_at).toLocaleString()}` : undefined}
        width="lg"
      >
        {detail ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-2xs font-bold uppercase tracking-wide text-slate-500">Actor</dt>
                <dd className="text-slate-800">{detail.actor_email ?? 'System'}</dd>
              </div>
              <div>
                <dt className="text-2xs font-bold uppercase tracking-wide text-slate-500">Entity</dt>
                <dd className="text-slate-800">
                  {detail.entity_type ?? '—'} {detail.entity_id ? `(${detail.entity_id})` : ''}
                </dd>
              </div>
              {platformMode ? (
                <div className="col-span-2">
                  <dt className="text-2xs font-bold uppercase tracking-wide text-slate-500">Tenant</dt>
                  <dd className="font-mono text-xs text-slate-800">{detail.tenant_id ?? 'platform'}</dd>
                </div>
              ) : null}
            </dl>
            <AuditStatePanel label="Before" state={detail.before_state} />
            <AuditStatePanel label="After" state={detail.after_state} />
            {detail.before_state && detail.after_state ? (
              <AuditChangedFields before={detail.before_state} after={detail.after_state} />
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

function AuditStatePanel({
  label,
  state,
}: {
  label: string;
  state: Record<string, unknown> | null;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</h3>
      {state ? (
        <pre className="max-h-64 overflow-auto rounded-xl border border-reos-border bg-slate-50 p-3 text-xs text-slate-800">
          {JSON.stringify(state, null, 2)}
        </pre>
      ) : (
        <p className="text-sm text-slate-500">No {label.toLowerCase()} state recorded.</p>
      )}
    </div>
  );
}

function AuditChangedFields({
  before,
  after,
}: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}) {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
  const changed = keys.filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));

  if (changed.length === 0) {
    return <p className="text-sm text-slate-500">No field-level differences detected.</p>;
  }

  return (
    <div>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Changed fields</h3>
      <ul className="space-y-2 text-sm">
        {changed.map((key) => (
          <li key={key} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <span className="font-mono text-xs font-semibold text-amber-900">{key}</span>
            <div className="mt-1 grid gap-1 text-xs text-slate-700">
              <div>
                <span className="font-semibold text-slate-500">Before: </span>
                {formatAuditValue(before[key])}
              </div>
              <div>
                <span className="font-semibold text-slate-500">After: </span>
                {formatAuditValue(after[key])}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
