export const metadata = {
  title: 'Terms of Service | RE-OS',
  description: 'Terms for browsing RE-OS public listing pages and submitting property inquiries.',
};

const TERMS = [
  {
    title: 'Using public listings',
    body: [
      'Property information is provided by the tenant organization managing each listing. Prices, availability, images, amenities, and site visit slots may change without notice.',
      'RE-OS aims to present verified, tenant-managed inventory, but final property details must be confirmed directly with the tenant organization before any decision or transaction.',
    ],
  },
  {
    title: 'Submitting inquiries',
    body: [
      'By submitting an inquiry, you authorize the relevant tenant organization to contact you by phone, email, or other communication channels about your selected property or similar requirements.',
      'You are responsible for providing accurate contact and requirement details. Misleading, abusive, or spam submissions may be blocked.',
    ],
  },
  {
    title: 'No brokerage or legal advice',
    body: [
      'Public pages are a discovery and inquiry tool. RE-OS does not provide legal, tax, valuation, or financial advice through these pages.',
      'Any brokerage, commission, booking amount, or transaction term must be agreed directly with the tenant organization and documented separately.',
    ],
  },
  {
    title: 'Acceptable use',
    body: [
      'You may browse listings and submit legitimate inquiries. You may not scrape aggressively, attempt to bypass rate limits, probe platform security, or submit spam.',
      'Do not upload or enter passwords, payment credentials, full PAN/Aadhaar numbers, or other sensitive documents into public inquiry messages.',
    ],
  },
  {
    title: 'Third-party services',
    body: [
      'Public pages may link to maps, WhatsApp, social profiles, or tenant websites. Those services are governed by their own terms and privacy practices.',
      'RE-OS is not responsible for third-party service availability, content, or transaction outcomes.',
    ],
  },
  {
    title: 'Changes to these terms',
    body: [
      'We may update these terms as the platform evolves. Continued use of public RE-OS pages after updates means you accept the revised terms.',
    ],
  },
];

export default function TermsPage() {
  return (
    <main>
      <section className="bg-slate-950 px-4 py-16 text-white">
        <div className="mx-auto max-w-4xl">
          <p className="eyebrow text-teal-300">Terms</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Terms of Service</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">
            Practical terms for browsing public listings, contacting property teams, and using RE-OS-powered websites.
          </p>
          <p className="mt-4 text-sm text-slate-400">Last updated: 12 June 2026</p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14">
        <div className="space-y-5">
          {TERMS.map((term) => (
            <section key={term.title} className="card p-6">
              <h2 className="text-xl font-bold text-slate-950">{term.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
                {term.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 rounded-3xl bg-amber-50 p-6 text-sm leading-7 text-amber-950 ring-1 ring-inset ring-amber-100">
          <strong>Launch note:</strong> These product terms are suitable for demo/readiness use and should be reviewed by counsel before production use.
        </div>
      </section>
    </main>
  );
}
