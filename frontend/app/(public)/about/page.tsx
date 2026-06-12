import Link from 'next/link';

export const metadata = {
  title: 'About | RE-OS',
  description:
    'RE-OS is the real estate operating system — verified listings, locality-led discovery, and CRM-backed inquiries for modern property teams.',
};

const STATS = [
  ['500+', 'Listings published'],
  ['5', 'Gujarat cities'],
  ['2 min', 'Avg. inquiry response'],
  ['98%', 'Verified inventory'],
];

const VALUES = [
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

const TEAM = [
  ['Operations', 'Listing quality, verification, and locality coverage.'],
  ['Sales enablement', 'Pipeline, follow-ups, and conversion tooling.'],
  ['Platform', 'Reliability, security, and white-label delivery.'],
];

export default function AboutPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-950 px-4 py-20 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.22),transparent_32rem),radial-gradient(circle_at_bottom_right,rgba(183,121,31,0.18),transparent_26rem)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="eyebrow text-teal-300">About RE-OS</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            A modern operating system for real estate teams.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-200">
            RE-OS turns property inventory into searchable, SEO-friendly websites and routes
            every inquiry into a CRM built for fast, accountable follow-up.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-reos-border bg-white px-4 py-10">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 sm:grid-cols-4">
          {STATS.map(([value, label]) => (
            <div key={label} className="text-center">
              <p className="text-3xl font-bold text-teal-800">{value}</p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="panel p-8">
            <p className="eyebrow">Our mission</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              Make property discovery trustworthy.
            </h2>
            <p className="mt-4 leading-7 text-slate-600">
              Buyers waste hours on outdated listings and unresponsive agents. We give teams the
              tools to publish verified inventory and respond to every lead within minutes — so
              buyers and sellers both win.
            </p>
          </div>
          <div className="panel p-8">
            <p className="eyebrow">Our vision</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              One platform, end to end.
            </h2>
            <p className="mt-4 leading-7 text-slate-600">
              From the public website to the CRM, analytics, billing, and AI assistance — RE-OS is
              a single system that scales from a solo agent to a multi-city agency.
            </p>
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section className="bg-white px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="eyebrow">Why choose us</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
              Built for how property teams actually work.
            </h2>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {VALUES.map((value) => (
              <div key={value.title} className="card card-hover p-6">
                <h3 className="text-lg font-bold text-slate-950">{value.title}</h3>
                <p className="mt-2 leading-7 text-slate-600">{value.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="max-w-2xl">
          <p className="eyebrow">Our team</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            People behind the platform.
          </h2>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {TEAM.map(([role, body]) => (
            <div key={role} className="card p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-base font-bold text-teal-800">
                {role.slice(0, 2)}
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-950">{role}</h3>
              <p className="mt-2 leading-7 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="bg-slate-950 px-4 py-14 text-white">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
          {[
            ['Tenant isolation', 'Every record is scoped to its organization. Your data stays yours.'],
            ['Secure by default', 'RS256 auth, rate limiting, audit logging, and RBAC on every route.'],
            ['Always improving', 'Shipping continuously — analytics, AI assistance, and white-label.'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h3 className="font-bold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-3xl border border-reos-border bg-gradient-to-br from-teal-50 to-white p-10 text-center shadow-card">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950">
            Ready to see it in action?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            Browse verified listings or talk to the team about putting your inventory on RE-OS.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/listings" className="btn-primary px-5 py-2.5">
              Browse listings
            </Link>
            <Link href="/contact" className="btn-secondary px-5 py-2.5">
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
