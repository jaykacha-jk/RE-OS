export const metadata = {
  title: 'Privacy Policy | RE-OS',
  description: 'How RE-OS handles public listing inquiries, analytics, and tenant CRM data.',
};

const SECTIONS = [
  {
    title: 'Information we collect',
    body: [
      'When you submit a listing or contact inquiry, we collect the details you provide: name, phone, email, preferred location, budget, and message.',
      'We may also collect basic technical metadata such as IP address, user agent, source page, and referral source for abuse prevention, analytics, and audit history.',
    ],
  },
  {
    title: 'How we use information',
    body: [
      'Inquiry data is used to respond to property requests, schedule site visits, recommend matching listings, and maintain CRM follow-up history for the relevant tenant organization.',
      'Aggregated analytics help tenant teams understand page performance, lead sources, and listing quality without exposing sensitive visitor details publicly.',
    ],
  },
  {
    title: 'What we do not collect on public pages',
    body: [
      'Public pages do not ask for passwords, payment credentials, PAN, Aadhaar, or other sensitive identity documents.',
      'Tenant teams should not request or store full PAN/Aadhaar numbers or passwords in public inquiry messages.',
    ],
  },
  {
    title: 'Sharing and tenant access',
    body: [
      'Your inquiry is shared with the tenant organization responsible for the listing or contact request so their sales team can follow up.',
      'RE-OS uses tenant isolation controls so each organization can access only its own CRM, listing, analytics, and billing records.',
    ],
  },
  {
    title: 'Retention and deletion',
    body: [
      'Inquiry and audit records are retained for operational, legal, and abuse-prevention purposes according to the tenant organization’s retention policy.',
      'To request correction or deletion, contact the tenant organization that received your inquiry or write to hello@reos.app.',
    ],
  },
  {
    title: 'Security',
    body: [
      'RE-OS uses role-based access controls, audit logging, rate limiting, and secure transport to protect platform data.',
      'No system is perfectly secure, but we design public inquiry capture to minimize sensitive data collection and route access through authorized tenant users.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main>
      <section className="bg-slate-950 px-4 py-16 text-white">
        <div className="mx-auto max-w-4xl">
          <p className="eyebrow text-teal-300">Privacy</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Privacy Policy</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">
            Clear, practical privacy terms for visitors using RE-OS public listing and inquiry pages.
          </p>
          <p className="mt-4 text-sm text-slate-400">Last updated: 12 June 2026</p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14">
        <div className="space-y-5">
          {SECTIONS.map((section) => (
            <section key={section.title} className="card p-6">
              <h2 className="text-xl font-bold text-slate-950">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 rounded-3xl bg-teal-50 p-6 text-sm leading-7 text-teal-950 ring-1 ring-inset ring-teal-100">
          <strong>Questions?</strong> Contact us at hello@reos.app or use the Contact page.
          This summary is provided for product launch readiness and should be reviewed by counsel before production use.
        </div>
      </section>
    </main>
  );
}
