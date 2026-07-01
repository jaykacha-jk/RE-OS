import Link from 'next/link';

import { EmptyState } from '../../../components/shared/EmptyState';
import { ErrorState } from '../../../components/shared/ErrorState';
import { fetchPublicListings, inr, propertyPath, resolvePublicTenantSlug } from '../../../lib/public-site';

export const revalidate = 300;

export const metadata = {
  title: 'Listings | RE-OS',
  description:
    'Search verified properties for sale, rent, and commercial use across tenant-managed public inventory.',
  openGraph: {
    title: 'Verified property listings | RE-OS',
    description:
      'Compare verified homes and workspaces, then request a callback from the local property team.',
    url: '/listings',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Verified property listings | RE-OS',
    description: 'Search tenant-managed public inventory for sale, rent, and commercial use.',
  },
};

export default async function PublicListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; search?: string; city?: string }>;
}) {
  const sp = await searchParams;
  const tenant = resolvePublicTenantSlug(sp.tenant);
  const { data, error } = await fetchPublicListings({ tenant, search: sp.search, city: sp.city });
  const city = sp.city ?? 'Ahmedabad';
  const citySlug = city.toLowerCase().replace(/\s+/g, '-');
  const activeFilters = [sp.search, sp.city].filter(Boolean).length;

  return (
    <main>
      <section className="relative overflow-hidden bg-slate-950 px-4 py-16 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.24),transparent_34rem),radial-gradient(circle_at_bottom_right,rgba(183,121,31,0.18),transparent_28rem)]" />
        <div className="relative mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-300">Verified listings</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Properties for sale, rent, and commercial use.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">
              Search tenant-managed inventory, compare verified homes and workspaces, and request a callback from the local team.
            </p>
          </div>

          <form className="mt-8 grid gap-3 rounded-3xl border border-white/10 bg-white p-3 shadow-premium md:grid-cols-[1fr_1fr_auto]" method="get">
            <input type="hidden" name="tenant" value={tenant} />
            <label>
              <span className="sr-only">Search</span>
              <input
                name="search"
                defaultValue={sp.search}
                placeholder="Area, project, property type"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-950 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
              />
            </label>
            <label>
              <span className="sr-only">City</span>
              <input
                name="city"
                defaultValue={sp.city}
                placeholder="Ahmedabad"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-950 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
              />
            </label>
            <button type="submit" className="rounded-2xl bg-teal-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-teal-800">
              Search
            </button>
          </form>
        </div>
      </section>

      <section className="border-b border-reos-border bg-white px-4 py-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
          {[
            ['Buy', `/buy/${citySlug}?tenant=${encodeURIComponent(tenant)}`],
            ['Rent', `/rent/${citySlug}?tenant=${encodeURIComponent(tenant)}`],
            ['Commercial', `/commercial/${citySlug}?tenant=${encodeURIComponent(tenant)}`],
          ].map(([label, href]) => (
            <Link key={label} href={href} className="rounded-full border border-reos-border bg-reos-bg px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800">
              {label} in {city}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Inventory</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              {data.length ? `${data.length} matching properties` : 'No matching properties yet'}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Showing public listings for <span className="font-semibold">{tenant}</span>
              {activeFilters ? ' with your current filters.' : '.'}
            </p>
          </div>
          {activeFilters ? (
            <Link href={`/listings?tenant=${encodeURIComponent(tenant)}`} className="btn-secondary">
              Clear filters
            </Link>
          ) : null}
        </div>

        {error ? (
          <div className="mt-8">
            <ErrorState
              title="Listings could not be loaded"
              message={`${error}. Please try again or contact the team for matching inventory.`}
              action={
                <>
                  <Link href={`/listings?tenant=${encodeURIComponent(tenant)}`} className="btn-primary">
                    Try again
                  </Link>
                  <Link href={`/contact?tenant=${encodeURIComponent(tenant)}`} className="btn-secondary">
                    Request help
                  </Link>
                </>
              }
            />
          </div>
        ) : data.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="No listings found"
              description="Try a wider city search, remove filters, or contact the team for matching inventory that is not public yet."
              action={
                <>
                  <Link href={`/listings?tenant=${encodeURIComponent(tenant)}`} className="btn-primary">
                    Reset search
                  </Link>
                  <Link href={`/contact?tenant=${encodeURIComponent(tenant)}`} className="btn-secondary">
                    Request help
                  </Link>
                </>
              }
            />
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((p) => (
              <Link
                key={p.slug}
                href={`${propertyPath(p)}?tenant=${encodeURIComponent(tenant)}`}
                className="group overflow-hidden rounded-3xl border border-reos-border bg-white shadow-card transition hover:-translate-y-1 hover:shadow-raised"
              >
                <div className="relative h-56 bg-slate-100">
                  {p.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.cover_image_url} alt={p.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  ) : null}
                  <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-teal-800 shadow-sm">
                    Verified
                  </span>
                </div>
                <div className="p-5">
                  <p className="text-xl font-bold text-teal-800">
                    {p.price ? inr.format(p.price) : 'Price on request'}
                  </p>
                  <h3 className="mt-2 line-clamp-2 text-lg font-bold leading-6 text-slate-950">{p.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    {p.city} · {p.category} · {p.requirement_type}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {p.bedrooms ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">{p.bedrooms} BHK</span> : null}
                    {p.carpet_area ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">{p.carpet_area} sqft</span> : null}
                    <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">Site visit ready</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
