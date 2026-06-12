'use client';

import Link from 'next/link';
import { FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';

import { apiFetch } from '../../../lib/api';
import { getSession, hasPermission } from '../../../lib/auth';
import {
  formatINR,
  humanize,
  PROPERTY_CATEGORIES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  statusBadgeClass,
  type ListMeta,
  type Property,
} from '../../../lib/properties';

export default function PropertiesPage() {
  const [rows, setRows] = useState<Property[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [canCreate, setCanCreate] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [city, setCity] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    setCanCreate(hasPermission(getSession(), 'properties.create'));
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
      if (type) params.set('filter[type]', type);
      if (category) params.set('filter[category]', category);
      if (status) params.set('filter[status]', status);
      if (city.trim()) params.set('filter[city]', city.trim());
      if (minPrice) params.set('filter[min_price]', minPrice);
      if (maxPrice) params.set('filter[max_price]', maxPrice);

      setLoading(true);
      setError(null);
      apiFetch<Property[]>(`/api/v1/properties?${params.toString()}`, {
        token: session.access_token,
      })
        .then((res) => {
          setRows(res.data);
          setMeta(res.meta as unknown as ListMeta);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load properties'))
        .finally(() => setLoading(false));
    },
    [search, type, category, status, city, minPrice, maxPrice, sortBy, sortDir],
  );

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortDir]);

  function onFilter(e: FormEvent) {
    e.preventDefault();
    load(1);
  }

  function resetFilters() {
    setSearch('');
    setType('');
    setCategory('');
    setStatus('');
    setCity('');
    setMinPrice('');
    setMaxPrice('');
  }

  const pageTotal = meta?.total ?? rows.length;
  const pageValue = rows.reduce((sum, row) => sum + (row.price ?? 0), 0);
  const published = rows.filter((row) => row.status === 'published').length;
  const reserved = rows.filter((row) => row.status === 'reserved').length;
  const publicListings = rows.filter((row) => row.is_public).length;

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
              Demo-ready inventory needs images, locality, price, status, and a clear owner.
            </p>
            {canCreate ? (
              <Link href="/properties/new" className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-bold text-teal-900 shadow-card transition hover:bg-teal-50 focus:outline-none focus:ring-4 focus:ring-white/30">
                Add property
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InventoryMetric label="Total inventory" value={pageTotal.toLocaleString('en-IN')} detail="tenant-scoped properties" />
        <InventoryMetric label="Page value" value={formatINR(pageValue)} detail="visible inventory value" tone="gold" />
        <InventoryMetric label="Published" value={published.toLocaleString('en-IN')} detail={`${publicListings} public listings visible`} tone="teal" />
        <InventoryMetric label="Reserved" value={reserved.toLocaleString('en-IN')} detail="active buyer intent" tone="blue" />
      </section>

      <form onSubmit={onFilter} className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Find the right listing</h2>
            <p className="mt-1 text-xs text-slate-500">Search by title, code, city, locality, price, status, and property class.</p>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              Apply filters
            </button>
            <button type="button" onClick={resetFilters} className="btn-secondary">
              Reset
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <FilterField label="Search" className="md:col-span-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
              placeholder="Search title, code, city, locality"
            />
          </FilterField>
          <FilterField label="Type">
            <select value={type} onChange={(e) => setType(e.target.value)} className="input">
              <option value="">All types</option>
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>{humanize(t)}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
              <option value="">All categories</option>
              {PROPERTY_CATEGORIES.map((c) => (
                <option key={c} value={c}>{humanize(c)}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
              <option value="">All statuses</option>
              {PROPERTY_STATUSES.map((s) => (
                <option key={s} value={s}>{humanize(s)}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="City">
            <input value={city} onChange={(e) => setCity(e.target.value)} className="input" placeholder="Ahmedabad" />
          </FilterField>
          <FilterField label="Min price">
            <input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} type="number" min="0" className="input" placeholder="5000000" />
          </FilterField>
          <FilterField label="Max price">
            <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} type="number" min="0" className="input" placeholder="25000000" />
          </FilterField>
        </div>
      </form>

      {loading ? <PropertyLoadingState /> : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
          <span className="font-semibold">Could not load properties.</span> {error}
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? <EmptyProperties canCreate={canCreate} /> : null}

      {!loading && !error && rows.length > 0 ? (
        <>
          {/* Cards: all rows on mobile/tablet (table is hidden there); featured 6 on desktop. */}
          <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {rows.map((row, index) => (
              <div key={row.id} className={index >= 6 ? 'lg:hidden' : ''}>
                <PropertyCard property={row} />
              </div>
            ))}
          </section>

          <section className="hidden overflow-hidden rounded-2xl border border-reos-border bg-white shadow-card lg:block">
            <div className="flex items-center justify-between border-b border-reos-border px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Operations table</h2>
                <p className="mt-1 text-xs text-slate-500">Dense view for owners and admins who need assignment and status at a glance.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-bold">Listing</th>
                    <th className="px-5 py-3 font-bold">Category</th>
                    <th className="px-5 py-3 font-bold">Price</th>
                    <th className="px-5 py-3 font-bold">City</th>
                    <th className="px-5 py-3 font-bold">Status</th>
                    <th className="px-5 py-3 font-bold">Assigned To</th>
                    <th className="px-5 py-3 font-bold">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const primary = primaryAssignment(row);
                    return (
                      <tr key={row.id} className="border-t border-slate-100 hover:bg-teal-50/40">
                        <td className="px-5 py-4">
                          <Link href={`/properties/${row.id}`} className="font-bold text-slate-900 hover:text-teal-800">
                            {row.title}
                          </Link>
                          <p className="mt-1 font-mono text-xs text-slate-500">{row.property_code}</p>
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {humanize(row.category)} · {humanize(row.type)}
                        </td>
                        <td className="px-5 py-4 font-semibold tabular-nums text-slate-900">{formatINR(row.price)}</td>
                        <td className="px-5 py-4 text-slate-700">{row.city}</td>
                        <td className="px-5 py-4">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-5 py-4 text-slate-700">{primary?.employee_name ?? 'Unassigned'}</td>
                        <td className="px-5 py-4 text-slate-500">
                          {new Date(row.updated_at).toLocaleDateString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {meta ? (
        <div className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-slate-600">
          <span>
            Page {meta.page} of {meta.total_pages} · {meta.total} total
          </span>
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
                <option value="price:desc">Price high to low</option>
                <option value="price:asc">Price low to high</option>
                <option value="title:asc">Title A to Z</option>
                <option value="updated_at:desc">Recently updated</option>
              </select>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={meta.page <= 1}
                onClick={() => load(meta.page - 1)}
                className="btn-secondary px-3 py-1.5"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={meta.page >= meta.total_pages}
                onClick={() => load(meta.page + 1)}
                className="btn-secondary px-3 py-1.5"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterField({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
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

function PropertyCard({ property }: { property: Property }) {
  const primary = primaryAssignment(property);
  const specs = [
    property.bedrooms ? `${property.bedrooms} bed` : null,
    property.bathrooms ? `${property.bathrooms} bath` : null,
    property.carpet_area ? `${property.carpet_area} sqft carpet` : null,
  ].filter((spec): spec is string => Boolean(spec));

  return (
    <Link href={`/properties/${property.id}`} className="group overflow-hidden rounded-3xl border border-reos-border bg-white shadow-card transition hover:-translate-y-1 hover:shadow-raised">
      <div className="relative h-52 bg-gradient-to-br from-slate-200 to-slate-100">
        {property.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={property.cover_image_url} alt={property.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center px-8 text-center">
            <div>
              <p className="text-sm font-bold text-slate-500">Image pending</p>
              <p className="mt-1 text-xs text-slate-400">Add a cover image to make this listing demo-ready.</p>
            </div>
          </div>
        )}
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <StatusBadge status={property.status} />
          {property.is_public ? (
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-teal-800 shadow-sm">Public</span>
          ) : null}
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xl font-bold tabular-nums text-teal-800">{formatINR(property.price)}</p>
            <h3 className="mt-2 line-clamp-2 text-base font-bold leading-6 text-slate-950">{property.title}</h3>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
            {humanize(property.requirement_type)}
          </span>
        </div>

        <p className="mt-2 text-sm text-slate-500">
          {property.city} · {humanize(property.category)} · {humanize(property.type)}
        </p>

        {specs.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {specs.map((spec) => (
              <span key={spec} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {spec}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
          <span className="font-mono text-slate-400">{property.property_code}</span>
          <span className="font-medium text-slate-500">{primary?.employee_name ?? 'Unassigned'}</span>
        </div>
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold shadow-sm ${statusBadgeClass(status)}`}>
      {humanize(status)}
    </span>
  );
}

function PropertyLoadingState() {
  return (
    <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-3xl border border-reos-border bg-white shadow-card">
          <div className="h-52 animate-pulse bg-slate-200" />
          <div className="space-y-3 p-5">
            <div className="h-6 w-32 animate-pulse rounded-xl bg-slate-200" />
            <div className="h-4 w-4/5 animate-pulse rounded-xl bg-slate-200" />
            <div className="h-4 w-2/3 animate-pulse rounded-xl bg-slate-200" />
          </div>
        </div>
      ))}
    </section>
  );
}

function EmptyProperties({ canCreate }: { canCreate: boolean }) {
  return (
    <section className="rounded-3xl border border-dashed border-teal-200 bg-gradient-to-br from-teal-50 to-white p-10 text-center shadow-card">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-700">No listings found</p>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">Your property inventory is waiting.</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
        Add demo-ready listings with images, prices, amenities, and locality context so the dashboard, public website, and CRM matching all feel alive.
      </p>
      {canCreate ? (
        <Link href="/properties/new" className="btn-primary mt-6">
          Add first property
        </Link>
      ) : null}
    </section>
  );
}

function primaryAssignment(property: Property) {
  return property.assignments.find((assignment) => assignment.is_primary) ?? property.assignments[0];
}
