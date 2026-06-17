'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';

import {
  CrudToolbar,
  DataTable,
  EmptyState,
  FilterDrawer,
  FilterField,
  PageHeader,
  Pagination,
  type DataTableColumn,
} from '../../../components/ui';
import { useTableQuery, type TableQueryValues } from '../../../hooks/use-table-query';
import { apiFetch } from '../../../lib/api';
import { getSession, hasPermission } from '../../../lib/auth';
import { downloadAuditCsv } from '../../../lib/settings';

type AuditLogRow = {
  id: string;
  tenant_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

type AuditMeta = {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
};

export default function AuditLogsPage() {
  return (
    <Suspense fallback={null}>
      <AuditLogsInner />
    </Suspense>
  );
}

const FILTER_KEYS = ['entity_type', 'actor_email', 'date_from', 'date_to'];

function AuditLogsInner() {
  const query = useTableQuery({ filterKeys: FILTER_KEYS, searchKey: 'action' });
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [meta, setMeta] = useState<AuditMeta | null>(null);
  const [draft, setDraft] = useState<TableQueryValues>(query.filters);
  const [filterOpen, setFilterOpen] = useState(false);
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
    { key: 'actor', header: 'Actor', render: (row) => <span className="text-slate-700">{row.actor_email ?? 'System'}</span> },
    { key: 'action', header: 'Action', render: (row) => <span className="font-mono text-xs text-slate-800">{row.action}</span> },
    {
      key: 'entity',
      header: 'Entity',
      render: (row) => (
        <span className="text-slate-700">{row.entity_type ?? '—'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Security"
        title="Audit logs"
        description="Tenant-scoped activity trail for auth, organization, employee, billing, and data changes."
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
          empty={<EmptyState title="No audit logs found" description="Try clearing filters or widening the date range." />}
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
            <input value={draft.date_from ?? ''} onChange={(e) => setDraft((d) => ({ ...d, date_from: e.target.value }))} type="date" className="input" />
          </FilterField>
          <FilterField label="To">
            <input value={draft.date_to ?? ''} onChange={(e) => setDraft((d) => ({ ...d, date_to: e.target.value }))} type="date" className="input" />
          </FilterField>
        </div>
      </FilterDrawer>
    </div>
  );
}
