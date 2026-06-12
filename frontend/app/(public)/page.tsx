import Link from 'next/link';

import { fetchPublicListings, fetchPublicSettings, inr, propertyPath } from '../../lib/public-site';

export const revalidate = 300;

export const metadata = {
  title: 'RE-OS | Verified Real Estate Listings',
  description:
    'Browse verified Gujarat properties, compare market-ready homes and commercial spaces, and request fast callbacks from local sales teams.',
  openGraph: {
    title: 'RE-OS | Verified Real Estate Listings',
    description:
      'Tenant-managed real estate discovery with verified listings, site visits, and CRM-backed callbacks.',
    url: '/',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RE-OS | Verified Real Estate Listings',
    description:
      'Browse verified Gujarat properties and request fast callbacks from local sales teams.',
  },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; city?: string }>;
}) {
  const sp = await searchParams;
  const tenant = sp.tenant ?? 'demo';
  const city = sp.city ?? 'Ahmedabad';
  const [{ data, meta }, settings] = await Promise.all([
    fetchPublicListings({ tenant, city, perPage: 6 }),
    fetchPublicSettings(tenant),
  ]);
  const citySlug = city.toLowerCase().replace(/\s+/g, '-');
  const areas = ['SG Highway', 'South Bopal', 'Science City', 'Prahlad Nagar', 'Satellite', 'Thaltej'];
  const siteName = settings?.name ?? 'RE-OS';
  const website = settings?.website;
  const heroTitle =
    website?.hero_title ?? `${siteName}: verified ${city} properties, curated by local sales teams.`;
  const heroSubtitle =
    website?.hero_subtitle ??
    'Browse tenant-managed listings, compare market-ready homes and commercial spaces, and book visits with teams who know the locality.';
  const contact = website?.contact ?? {};
  const testimonials = (website?.testimonials ?? []).filter((item) => item.quote && item.author).slice(0, 3);
  const trustCards = (website?.featured_sections ?? [])
    .filter((item) => item.enabled !== false && item.title)
    .slice(0, 3);
  const totalListings = meta?.total ?? data.length;
  const stats = [
    [totalListings ? `${totalListings}+` : `${data.length}`, 'verified listings'],
    [city, 'active city'],
    [contact.phone || contact.whatsapp ? 'Direct' : 'Fast', 'callback channel'],
  ];

  return (
    <main className="bg-reos-bg">
      <section className="relative overflow-hidden bg-slate-950 px-4 py-20 text-white sm:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.25),transparent_34rem),radial-gradient(circle_at_bottom_right,rgba(183,121,31,0.22),transparent_28rem)]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-teal-200">Premium real estate discovery</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl">
              {heroTitle}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
              {heroSubtitle}
            </p>

            <form className="mt-8 flex max-w-3xl flex-wrap gap-3 rounded-3xl border border-white/10 bg-white p-3 shadow-premium" method="get">
              <input type="hidden" name="tenant" value={tenant} />
              <label className="min-w-44 flex-1">
                <span className="sr-only">City</span>
                <input
                  name="city"
                  defaultValue={city}
                  placeholder="Ahmedabad"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-950 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                />
              </label>
              <button type="submit" className="rounded-2xl bg-teal-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-800">
                Update city
              </button>
              <Link
                href={`/buy/${citySlug}?tenant=${encodeURIComponent(tenant)}`}
                className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
              >
                Browse {city}
              </Link>
            </form>

            <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3 text-sm">
              {stats.map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="mt-1 text-xs text-slate-300">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-3 shadow-premium backdrop-blur">
            <div className="overflow-hidden rounded-[1.5rem] bg-white text-slate-950">
              <div className="h-72 bg-slate-200">
                {data[0]?.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data[0].cover_image_url} alt={data[0].title} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Featured now</p>
                <h2 className="mt-2 text-2xl font-bold">{data[0]?.title ?? 'Luxury villa in Ahmedabad'}</h2>
                <p className="mt-2 text-sm text-slate-500">{data[0]?.city ?? city} · {siteName} · Site visit ready</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Featured listings</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Properties in {city}</h2>
            <p className="mt-2 text-sm text-slate-600">Premium inventory with CRM-backed inquiry capture.</p>
          </div>
          <Link
            href={`/listings?tenant=${encodeURIComponent(tenant)}&city=${encodeURIComponent(city)}`}
            className="btn-secondary"
          >
            View all listings
          </Link>
        </div>

        {data.length ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((property) => (
              <Link
                key={property.slug}
                href={`${propertyPath(property)}?tenant=${encodeURIComponent(tenant)}`}
                className="group overflow-hidden rounded-3xl border border-reos-border bg-white shadow-card transition hover:-translate-y-1 hover:shadow-raised"
              >
                <div className="h-56 bg-slate-100">
                  {property.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={property.cover_image_url} alt={property.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  ) : null}
                </div>
                <div className="p-5">
                  <p className="text-xl font-bold text-teal-800">
                    {property.price ? inr.format(property.price) : 'Price on request'}
                  </p>
                  <h3 className="mt-2 text-lg font-bold leading-6 text-slate-950">{property.title}</h3>
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
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-dashed border-teal-200 bg-white p-10 text-center text-slate-600 shadow-card">
            No public listings available for {tenant} yet. Seed demo listings to make this page shine.
          </div>
        )}
      </section>

      <section className="bg-white px-4 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="eyebrow">Area insights</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Locality-led discovery for serious buyers.</h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {areas.map((area) => (
              <Link key={area} href={`/buy/${citySlug}?tenant=${encodeURIComponent(tenant)}&search=${encodeURIComponent(area)}`} className="rounded-2xl border border-reos-border bg-reos-bg p-5 transition hover:-translate-y-1 hover:border-teal-200 hover:shadow-card">
                <p className="text-lg font-bold text-slate-950">{area}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">Premium homes, investment inventory, and site-visit-ready opportunities.</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-4 py-14 text-white">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
          {(trustCards.length
            ? trustCards.map((item) => [item.title ?? '', item.subtitle ?? ''])
            : [
                ['Verified inventory', 'Listings are managed by tenant teams, not scraped from stale portals.'],
                ['CRM-backed inquiry flow', 'Every form submit becomes a trackable sales lead with source attribution.'],
                ['Local service', contact.address ? `Visit us at ${contact.address}.` : 'Local specialists help coordinate site visits and callbacks.'],
              ]).map(([title, text]) => (
            <div key={title} className="rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur">
              <h3 className="font-bold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {testimonials.length ? (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="max-w-2xl">
            <p className="eyebrow">Client stories</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Trusted by {siteName} clients.</h2>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {testimonials.map((item) => {
              const name = item.author ?? 'Client';
              return (
                <figure key={`${name}-${item.quote}`} className="card p-6">
                  <blockquote className="leading-7 text-slate-700">{item.quote}</blockquote>
                  <figcaption className="mt-4 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-800">
                      {name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-slate-950">{name}</span>
                      {item.role ? <span className="block text-xs text-slate-500">{item.role}</span> : null}
                    </span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* CTA banner */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="overflow-hidden rounded-3xl bg-slate-950 px-8 py-12 text-center text-white sm:px-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Find your next property with {siteName}.</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">
            {contact.phone || contact.email
              ? `Reach the team${contact.phone ? ` at ${contact.phone}` : ''}${contact.email ? ` or ${contact.email}` : ''}.`
              : 'Browse verified listings and request a callback in seconds — every inquiry reaches the team instantly.'}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href={`/listings?tenant=${encodeURIComponent(tenant)}&city=${encodeURIComponent(city)}`}
              className="rounded-2xl bg-teal-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-teal-400"
            >
              Browse listings
            </Link>
            <Link
              href={`/contact?tenant=${encodeURIComponent(tenant)}`}
              className="rounded-2xl border border-white/20 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
