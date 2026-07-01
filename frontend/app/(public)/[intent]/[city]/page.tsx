import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  fetchPublicListings,
  formatCityTitle,
  inr,
  intentLabel,
  isPublicIntent,
  propertyPath,
  resolvePublicTenantSlug,
} from '../../../../lib/public-site';

export const revalidate = 300;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ intent: string; city: string }>;
  searchParams: Promise<{ tenant?: string }>;
}): Promise<Metadata> {
  const { intent, city } = await params;
  const { tenant } = await searchParams;
  if (!isPublicIntent(intent)) return { title: 'Not found' };
  const cityTitle = formatCityTitle(city);
  const label = intentLabel(intent);
  return {
    title: `${label} properties in ${cityTitle} | ${tenant ?? 'RE-OS'}`,
    description: `Explore verified ${label.toLowerCase()} properties in ${cityTitle}. Compare prices, amenities, and request a callback.`,
    alternates: { canonical: `/${intent}/${city}` },
    openGraph: {
      title: `${label} properties in ${cityTitle}`,
      description: `Browse public listings in ${cityTitle}.`,
      url: `/${intent}/${city}`,
      type: 'website',
    },
  };
}

export default async function CityHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ intent: string; city: string }>;
  searchParams: Promise<{ tenant?: string; search?: string }>;
}) {
  const { intent, city } = await params;
  const sp = await searchParams;
  if (!isPublicIntent(intent)) notFound();

  const tenant = resolvePublicTenantSlug(sp.tenant);
  const cityTitle = formatCityTitle(city);
  const { data, meta } = await fetchPublicListings({
    tenant,
    city: cityTitle,
    intent,
    search: sp.search,
    perPage: 24,
  });
  const label = intentLabel(intent);
  const activeFilters = sp.search ? 1 : 0;
  const alternateIntents = [
    ['Buy', 'buy'],
    ['Rent', 'rent'],
    ['Commercial', 'commercial'],
  ];
  const localityHighlights = ['Verified inventory', 'Site visit ready', 'CRM callback', 'Local team'];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${label} properties in ${cityTitle}`,
    description: `Public ${label.toLowerCase()} property listings in ${cityTitle}`,
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="relative overflow-hidden bg-slate-950 px-4 py-16 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.24),transparent_34rem),radial-gradient(circle_at_bottom_right,rgba(183,121,31,0.2),transparent_30rem)]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-300">RE-OS public website</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              {label} properties in <span className="capitalize">{cityTitle}</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">
              Discover verified {label.toLowerCase()} inventory, compare prices, and send inquiries directly into the tenant CRM.
            </p>
            <form className="mt-8 grid max-w-2xl gap-3 rounded-3xl border border-white/10 bg-white p-3 shadow-premium sm:grid-cols-[1fr_auto]" method="get">
              <input type="hidden" name="tenant" value={tenant} />
              <label>
                <span className="sr-only">Search locality, project, amenity</span>
                <input
                  name="search"
                  defaultValue={sp.search}
                  placeholder="Search locality, project, amenity"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-950 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                />
              </label>
              <button type="submit" className="rounded-2xl bg-teal-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-teal-800">
                Search
              </button>
            </form>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-premium backdrop-blur">
            <p className="text-sm font-semibold text-teal-200">Market snapshot</p>
            <dl className="mt-5 grid grid-cols-2 gap-3">
              {[
                [String(meta?.total ?? data.length), 'public listings'],
                [cityTitle, 'market focus'],
                [label, 'intent'],
                ['2 hr', 'callback SLA'],
              ].map(([value, title]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <dt className="text-xs text-slate-300">{title}</dt>
                  <dd className="mt-1 truncate text-2xl font-bold text-white">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="border-b border-reos-border bg-white px-4 py-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
          {alternateIntents.map(([intentLabelText, targetIntent]) => (
            <Link
              key={targetIntent}
              href={`/${targetIntent}/${city}?tenant=${encodeURIComponent(tenant)}`}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                targetIntent === intent
                  ? 'border-teal-200 bg-teal-50 text-teal-800'
                  : 'border-reos-border bg-reos-bg text-slate-700 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800'
              }`}
            >
              {intentLabelText} in {cityTitle}
            </Link>
          ))}
          <Link href={`/listings?tenant=${encodeURIComponent(tenant)}&city=${encodeURIComponent(cityTitle)}`} className="rounded-full border border-reos-border bg-reos-bg px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800">
            All listings
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Live inventory</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              {data.length ? `${data.length} ${label.toLowerCase()} listings` : `No ${label.toLowerCase()} listings yet`}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Tenant-managed public inventory for <span className="font-semibold capitalize">{cityTitle}</span>
              {activeFilters ? ' with your current search.' : '.'}
            </p>
          </div>
          {activeFilters ? (
            <Link href={`/${intent}/${city}?tenant=${encodeURIComponent(tenant)}`} className="btn-secondary">
              Clear search
            </Link>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {localityHighlights.map((item) => (
            <span key={item} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-inset ring-reos-border">
              {item}
            </span>
          ))}
        </div>

        {data.length === 0 ? (
          <section className="mt-8 rounded-3xl border border-dashed border-teal-200 bg-white p-10 text-center shadow-card">
            <h2 className="text-xl font-bold text-slate-950">No public listings found</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              Try a broader search, browse all listings, or contact the team for matching inventory that is not public yet.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link href={`/listings?tenant=${encodeURIComponent(tenant)}&city=${encodeURIComponent(cityTitle)}`} className="btn-primary">
                Browse all {cityTitle}
              </Link>
              <Link href={`/contact?tenant=${encodeURIComponent(tenant)}`} className="btn-secondary">
                Request help
              </Link>
            </div>
          </section>
        ) : (
          <section className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((property) => (
              <Link
                key={property.slug}
                href={`${propertyPath(property)}?tenant=${encodeURIComponent(tenant)}`}
                className="group overflow-hidden rounded-3xl border border-reos-border bg-white shadow-card transition hover:-translate-y-1 hover:shadow-raised"
              >
                <div className="relative h-56 bg-slate-100">
                  {property.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={property.cover_image_url} alt={property.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  ) : null}
                  <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-teal-800 shadow-sm">
                    {label}
                  </span>
                </div>
                <div className="p-5">
                  <p className="text-xl font-bold text-teal-800">
                    {property.price ? inr.format(property.price) : 'Price on request'}
                  </p>
                  <h2 className="mt-2 line-clamp-2 text-lg font-bold leading-6 text-slate-950">{property.title}</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {property.city} · {property.category} · {property.requirement_type}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {property.bedrooms ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">{property.bedrooms} BHK</span> : null}
                    {property.carpet_area ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">{property.carpet_area} sqft</span> : null}
                    <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">Verified</span>
                  </div>
                </div>
              </Link>
            ))}
          </section>
        )}

        <section className="mt-14 rounded-3xl bg-slate-950 p-8 text-white sm:p-10">
          <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-300">Local guide</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">Why invest time in {cityTitle}?</h2>
              <p className="mt-3 leading-7 text-slate-300">
                {cityTitle} has active demand across residential and commercial segments. This page is generated from live
                public inventory so buyers can discover properties and teams can convert inquiries inside RE-OS.
              </p>
            </div>
            <Link href={`/contact?tenant=${encodeURIComponent(tenant)}`} className="rounded-2xl bg-teal-500 px-6 py-3 text-center text-sm font-bold text-white transition hover:bg-teal-400">
              Talk to a local expert
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
