import { ContactForm } from '../../../components/public/contact-form';
import { fetchPublicSettings } from '../../../lib/public-site';

export const metadata = {
  title: 'Contact | RE-OS',
  description:
    'Contact the RE-OS team for property inquiries, callbacks, and site visits. We respond fast.',
  openGraph: {
    title: 'Contact RE-OS',
    description:
      'Request property callbacks, site visits, and help finding verified tenant-managed inventory.',
    url: '/contact',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact RE-OS',
    description: 'Request property callbacks, site visits, and help finding verified listings.',
  },
};

const FAQS = [
  {
    q: 'How fast will I get a response?',
    a: 'Most inquiries are answered within a couple of hours during business hours. Urgent requests get a callback the same day.',
  },
  {
    q: 'Can I schedule a site visit?',
    a: 'Yes. Mention your preferred date in the message, or ask on any property page — the team coordinates visits directly.',
  },
  {
    q: 'Do you charge buyers?',
    a: 'Browsing listings and submitting inquiries is free for buyers and renters. Listing fees apply to property teams.',
  },
  {
    q: 'Is my information secure?',
    a: 'Your details are stored securely and shared only with the relevant sales team to respond to your request.',
  },
];

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const sp = await searchParams;
  const tenant = sp.tenant ?? 'demo';
  const settings = await fetchPublicSettings(tenant);
  const siteName = settings?.name ?? 'RE-OS';
  const contact = settings?.website?.contact ?? {};
  const phone = contact.phone ?? contact.whatsapp ?? null;
  const email = contact.email ?? null;
  const address = contact.address ?? null;

  return (
    <main>
      <section className="relative overflow-hidden bg-slate-950 px-4 py-16 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.2),transparent_30rem)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="eyebrow text-teal-300">Contact</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Talk to {siteName}.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-200">
            Questions about a listing, a site visit, or putting your inventory online? Reach out
            and the right team will get back to you.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <ContactForm tenant={tenant} />

          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="text-lg font-bold text-slate-950">Talk to us</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Phone</dt>
                  <dd className="font-semibold text-slate-900">{phone ?? 'Configure in settings'}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Email</dt>
                  <dd className="font-semibold text-slate-900">{email ?? 'Configure in settings'}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Hours</dt>
                  <dd className="font-semibold text-slate-900">Mon–Sat, 9am–7pm IST</dd>
                </div>
              </dl>
            </div>

            {address ? (
              <div className="card p-6">
                <h3 className="text-base font-bold text-slate-950">Office</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{address}</p>
                {phone ? <p className="mt-1 text-sm font-semibold text-teal-800">{phone}</p> : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <p className="eyebrow">FAQ</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Common questions</h2>
          </div>
          <div className="mt-10 space-y-4">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group card p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-slate-950">
                  {faq.q}
                  <span className="text-teal-700 transition group-open:rotate-45">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-7 text-slate-600">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
