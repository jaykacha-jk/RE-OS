'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { ActionGuard } from '../../../components/shared/ActionGuard';
import { PropertyCsvImportButton } from '../../../components/properties/property-csv-import';
import { QuotaNotice, proactiveQuotaNoticeProps } from '../../../components/billing/quota-notice';
import {
  ActionMenu,
  CrudToolbar,
  DataTable,
  EmptyState,
  FilterDrawer,
  FilterField,
  Icon,
  Pagination,
  StatusBadge,
  type DataTableColumn,
} from '../../../components/ui';
import { useTableQuery, type TableQueryValues } from '../../../hooks/use-table-query';
import { useBillingUsage } from '../../../hooks/use-billing-usage';
import { apiFetch } from '../../../lib/api';
import { getSession, hasPermission, type AuthSession } from '../../../lib/auth';
import { proactiveQuotaMessage } from '../../../lib/quota';
import {
  formatINR,
  humanize,
  PROPERTY_CATEGORIES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  statusBadgeClass,
  type ListMeta,
  type Property,
  type PropertySummary,
} from '../../../lib/properties';

const FILTER_KEYS = ['type', 'category', 'status', 'city', 'min_price', 'max_price'];

export default function PropertiesPage() {
  return (
    <Suspense fallback={null}>
      <PropertiesInner />
    </Suspense>
  );
}

function PropertiesInner() {
  const query = useTableQuery({
    filterKeys: FILTER_KEYS,
    defaults: { sort_by: 'created_at', sort_dir: 'desc' },
    defaultPerPage: 10,
  });

  const [rows, setRows] = useState<Property[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [summary, setSummary] = useState<PropertySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<TableQueryValues>(query.filters);
  const [session, setSession] = useState<AuthSession | null>(null);
  const { usage, propertyAtLimit } = useBillingUsage();

  useEffect(() => {
    setSession(getSession());
  }, []);

  const canUpdate = hasPermission(session, 'properties.update');

  const { search, filters, sortBy, sortDir, page, setPage, perPage, setPerPage } = query;
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
    if (f.type) params.set('filter[type]', f.type);
    if (f.category) params.set('filter[category]', f.category);
    if (f.status) params.set('filter[status]', f.status);
    if (f.city?.trim()) params.set('filter[city]', f.city.trim());
    if (f.min_price) params.set('filter[min_price]', f.min_price);
    if (f.max_price) params.set('filter[max_price]', f.max_price);

    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch<Property[]>(`/api/v1/properties?${params.toString()}`, { token: active.access_token }),
      apiFetch<PropertySummary>(`/api/v1/properties/summary?${params.toString()}`, { token: active.access_token }),
    ])
      .then(([listRes, summaryRes]) => {
        setRows(listRes.data);
        setMeta(listRes.meta as unknown as ListMeta);
        setSummary(summaryRes.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load properties'))
      .finally(() => setLoading(false));
  }, [page, perPage, sortBy, sortDir, search, filtersKey]);

  useEffect(() => {
    load();
  }, [load]);

  function openFilter() {
    setDraft(filters);
    setFilterOpen(true);
  }

  const pageTotal = summary?.total ?? meta?.total ?? rows.length;
  const totalValue = summary?.total_value ?? 0;
  const published = summary?.published ?? 0;
  const reserved = summary?.reserved ?? 0;
  const publicListings = summary?.public_listings ?? 0;

  const columns: DataTableColumn<Property>[] = [
    {
      key: 'listing',
      header: 'Listing',
      render: (row) => (
        <div>
          <Link href={`/properties/${row.id}`} className="font-semibold text-slate-900 hover:text-teal-800">
            {row.title}
          </Link>
          <p className="mt-0.5 font-mono text-2xs text-slate-500">{row.property_code}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => (
        <span className="text-slate-700">
          {humanize(row.category)} · {humanize(row.type)}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      cellClassName: 'font-semibold tabular-nums text-slate-900',
      render: (row) => formatINR(row.price),
    },
    { key: 'city', header: 'City', render: (row) => <span className="text-slate-700">{row.city}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge label={humanize(row.status)} className={statusBadgeClass(row.status)} />
      ),
    },
    {
      key: 'assigned',
      header: 'Assigned To',
      render: (row) => <span className="text-slate-700">{primaryAssignment(row)?.employee_name ?? 'Unassigned'}</span>,
    },
    {
      key: 'updated',
      header: 'Updated',
      cellClassName: 'text-slate-500',
      render: (row) => new Date(row.updated_at).toLocaleDateString('en-IN'),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-teal-100 bg-white shadow-card">
        <div className="grid gap-6 bg-gradient-to-br from-slate-950 via-teal-950 to-slate-900 p-6 text-white lg:grid-cols-[1.4fr_1fr] lg:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-200">Inventory command center</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Properties</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
              Manage tenant-scoped listings, public inventory, assignments, and sales-ready property context.
            </p>
          </div>
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <p className="text-sm text-slate-200">
              Complete inventory needs images, locality, price, status, and a clear owner.
            </p>
            <ActionGuard permission="properties.create">
              {propertyAtLimit ? (
                <span className="inline-flex cursor-not-allowed items-center justify-center rounded-xl bg-white/60 px-4 py-2 text-sm font-bold text-slate-400">
                  Add property
                </span>
              ) : (
                <Link
                  href="/properties/new"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-bold text-teal-900 shadow-card transition hover:bg-teal-50 focus:outline-none focus:ring-4 focus:ring-white/30"
                >
                  Add property
                </Link>
              )}
            </ActionGuard>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InventoryMetric label="Total inventory" value={pageTotal.toLocaleString('en-IN')} detail="tenant-scoped properties" />
        <InventoryMetric label="Inventory value" value={formatINR(totalValue)} detail="filtered tenant inventory value" tone="gold" />
        <InventoryMetric label="Published" value={published.toLocaleString('en-IN')} detail={`${publicListings} public listings`} tone="teal" />
        <InventoryMetric label="Reserved" value={reserved.toLocaleString('en-IN')} detail="active buyer intent" tone="blue" />
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
          <span className="font-semibold">Could not load properties.</span> {error}
        </div>
      ) : null}

      {usage && propertyAtLimit ? (
        <QuotaNotice
          {...proactiveQuotaNoticeProps(
            'properties',
            usage.plan.name,
            `${proactiveQuotaMessage('properties', usage)} Upgrade to add more listings.`,
          )}
        />
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-reos-border bg-white shadow-card">
        <CrudToolbar
          searchValue={query.searchInput}
          onSearchChange={query.setSearchInput}
          searchPlaceholder="Search title, code, city, locality"
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
                <option value="price:desc">Price high to low</option>
                <option value="price:asc">Price low to high</option>
                <option value="title:asc">Title A to Z</option>
                <option value="updated_at:desc">Recently updated</option>
              </select>
            </label>
          }
          onFilter={openFilter}
          filterCount={query.activeFilterCount}
          onRefresh={load}
          refreshing={loading}
          addSlot={
            <ActionGuard permission="properties.create">
              <div className="flex flex-wrap items-center gap-2">
                <PropertyCsvImportButton onImported={load} disabled={propertyAtLimit} />
                {propertyAtLimit ? (
                  <span className="btn-primary cursor-not-allowed opacity-50">
                    <Icon name="plus" className="h-4 w-4" /> Add property
                  </span>
                ) : (
                  <Link href="/properties/new" className="btn-primary">
                    <Icon name="plus" className="h-4 w-4" /> Add property
                  </Link>
                )}
              </div>
            </ActionGuard>
          }
        />

        <DataTable<Property>
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={loading}
          loadingRows={perPage}
          empty={
            <EmptyState
              title="No listings match your filters"
              description="Adjust filters or add a listing with images, price, status, and a clear owner."
              action={
                <ActionGuard permission="properties.create">
                  {propertyAtLimit ? (
                    <span className="btn-primary cursor-not-allowed opacity-50">Add first property</span>
                  ) : (
                    <Link href="/properties/new" className="btn-primary">
                      Add first property
                    </Link>
                  )}
                </ActionGuard>
              }
            />
          }
          actions={(row) => (
            <ActionMenu
              items={[
                { label: 'View', href: `/properties/${row.id}` },
                { label: 'Edit', href: `/properties/${row.id}/edit`, hidden: !canUpdate },
              ]}
            />
          )}
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
        title="Filter properties"
        onApply={() => {
          query.applyFilters(draft);
          setFilterOpen(false);
        }}
        onClear={() => {
          query.clearFilters();
          setDraft(Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])));
          setFilterOpen(false);
        }}
      >
        <FilterField label="Type">
          <select value={draft.type ?? ''} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))} className="input">
            <option value="">All types</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>{humanize(t)}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Category">
          <select value={draft.category ?? ''} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} className="input">
            <option value="">All categories</option>
            {PROPERTY_CATEGORIES.map((c) => (
              <option key={c} value={c}>{humanize(c)}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Status">
          <select value={draft.status ?? ''} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))} className="input">
            <option value="">All statuses</option>
            {PROPERTY_STATUSES.map((s) => (
              <option key={s} value={s}>{humanize(s)}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="City">
          <input value={draft.city ?? ''} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} className="input" placeholder="Ahmedabad" />
        </FilterField>
        <div className="grid grid-cols-2 gap-3">
          <FilterField label="Min price">
            <input
              value={draft.min_price ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, min_price: e.target.value }))}
              type="number"
              min="0"
              className="input"
              placeholder="5000000"
            />
          </FilterField>
          <FilterField label="Max price">
            <input
              value={draft.max_price ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, max_price: e.target.value }))}
              type="number"
              min="0"
              className="input"
              placeholder="25000000"
            />
          </FilterField>
        </div>
      </FilterDrawer>
    </div>
  );
}

function InventoryMetric({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'default' | 'teal' | 'gold' | 'blue';
}) {
  const toneClass =
    tone === 'teal'
      ? 'from-white to-teal-50 text-teal-800'
      : tone === 'gold'
        ? 'from-white to-amber-50 text-amber-800'
        : tone === 'blue'
          ? 'from-white to-blue-50 text-blue-800'
          : 'from-white to-slate-50 text-slate-950';

  return (
    <div className={`rounded-2xl border border-reos-border bg-gradient-to-br p-5 shadow-card ${toneClass}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function primaryAssignment(property: Property) {
  return property.assignments.find((assignment) => assignment.is_primary) ?? property.assignments[0];
}
