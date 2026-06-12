import Link from 'next/link';

import { fetchPublicListings, fetchPublicSettings } from '../../../lib/public-site';

export const metadata = {
  title: 'About | RE-OS',
  description:
    'RE-OS is the real estate operating system — verified listings, locality-led discovery, and CRM-backed inquiries for modern property teams.',
  openGraph: {
    title: 'About RE-OS',
    description:
      'A real estate operating system for verified public listings, locality-led discovery, and accountable CRM follow-up.',
    url: '/about',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About RE-OS',
    description:
      'Verified inventory, locality-led discovery, and CRM-backed response for modern property teams.',
  },
};

const FALLBACK_VALUES = [
  {
    title: 'Verified inventory',
    body: 'Listings are managed by tenant sales teams, never scraped from stale portals. What you see is real and available.',
  },
  {
    title: 'Locality-led discovery',
    body: 'Search by city and area with SEO-friendly pages built for serious buyers, not noise.',
  },
  {
    title: 'CRM-backed response',
    body: 'Every inquiry becomes a trackable lead with source attribution, so teams call back fast.',
  },
  {
    title: 'White-label ready',
    body: 'Tenant branding, custom domains, and SEO pages make the platform feel like your own.',
  },
];

export default async function AboutPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const sp = await searchParams;
  const tenant = sp.tenant ?? 'demo';
  const tenantQuery = `?tenant=${encodeURIComponent(tenant)}`;
  const [settings, listings] = await Promise.all([
    fetchPublicSettings(tenant),
    fetchPublicListings({ tenant, perPage: 1 }),
  ]);

  const siteName = settings?.name ?? 'RE-OS';
  const website = settings?.website;
  const aboutText =
    website?.footer?.about ??
    website?.hero_subtitle ??
    `${siteName} turns property inventory into searchable websites and routes every inquiry into a CRM built for fast follow-up.`;
  const trustCards = (website?.featured_sections ?? [])
    .filter((item) => item.enabled !== false && item.title)
    .slice(0, 4);
  const values =
    trustCards.length > 0
      ? trustCards.map((item) => ({
          title: item.title!,
          body: item.subtitle ?? '',
        }))
      : FALLBACK_VALUES;
  const testimonials = (website?.testimonials ?? []).filter((item) => item.quote && item.author).slice(0, 3);
  const totalListings = listings.meta?.total ?? listings.data.length;
  const city = website?.contact?.address?.split(',')[1]?.trim() ?? 'your city';
  const stats = [
    [totalListings ? `${totalListings}+` : '—', 'Listings published'],
    [city, 'Primary market'],
    [website?.contact?.phone || website?.contact?.whatsapp ? 'Direct' : 'Fast', 'Callback channel'],
    [testimonials.length ? `${testimonials.length}` : 'CRM', testimonials.length ? 'Client stories' : 'Backed inquiries'],
  ];

  return (
    <main>
      <section className="relative overflow-hidden bg-slate-950 px-4 py-20 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.22),transparent_32rem),radial-gradient(circle_at_bottom_right,rgba(183,121,31,0.18),transparent_26rem)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="eyebrow text-teal-300">About {siteName}</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            {website?.hero_title ?? `A modern operating system for ${siteName}.`}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-200">{aboutText}</p>
        </div>
      </section>

      <section className="border-b border-reos-border bg-white px-4 py-10">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 sm:grid-cols-4">
          {stats.map(([value, label]) => (
            <div key={label} className="text-center">
              <p className="text-3xl font-bold text-teal-800">{value}</p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="panel p-8">
            <p className="eyebrow">Our mission</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              Make property discovery trustworthy.
            </h2>
            <p className="mt-4 leading-7 text-slate-600">{aboutText}</p>
          </div>
          <div className="panel p-8">
            <p className="eyebrow">How we work</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              One team, one pipeline.
            </h2>
            <p className="mt-4 leading-7 text-slate-600">
              From the public website to the CRM, {siteName} keeps inventory, inquiries, and follow-ups
              in a single system so buyers get timely responses.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="eyebrow">Why choose us</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
              Built for how property teams actually work.
            </h2>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {values.map((value) => (
              <div key={value.title} className="card card-hover p-6">
                <h3 className="text-lg font-bold text-slate-950">{value.title}</h3>
                <p className="mt-2 leading-7 text-slate-600">{value.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {testimonials.length ? (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="max-w-2xl">
            <p className="eyebrow">Client stories</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
              What buyers say about {siteName}.
            </h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {testimonials.map((item) => (
              <blockquote key={`${item.author}-${item.quote?.slice(0, 24)}`} className="card p-6">
                <p className="text-sm leading-7 text-slate-600">&ldquo;{item.quote}&rdquo;</p>
                <footer className="mt-4 text-sm font-semibold text-slate-950">
                  {item.author}
                  {item.role ? <span className="font-normal text-slate-500"> · {item.role}</span> : null}
                </footer>
              </blockquote>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-3xl border border-reos-border bg-gradient-to-br from-teal-50 to-white p-10 text-center shadow-card">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950">Ready to see it in action?</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            Browse verified listings or talk to {siteName} about your next property move.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href={`/listings${tenantQuery}`} className="btn-primary px-5 py-2.5">
              Browse listings
            </Link>
            <Link href={`/contact${tenantQuery}`} className="btn-secondary px-5 py-2.5">
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
