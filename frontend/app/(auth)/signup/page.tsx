import Link from 'next/link';

import { SignupForm } from './signup-form';

const TRUST_POINTS = [
  '14-day trial with starter limits applied automatically',
  'Owner workspace, role assignment, lead sources, and usage counters created instantly',
  'Verification email sent before dashboard access',
];

export default function SignupPage() {
  return (
    <main className="premium-gradient flex min-h-screen flex-col lg:flex-row">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-teal-900 via-slate-900 to-slate-950 px-10 py-12 text-white lg:flex lg:w-1/2 lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
        <Link href="/" className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500 text-lg font-bold text-white shadow-raised">
            RE
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight">RE-OS</p>
            <p className="text-xs text-slate-300">Premium real estate operating system</p>
          </div>
        </Link>

        <div className="relative max-w-md">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">
            Start without setup calls
          </p>
          <h2 className="mt-4 text-4xl font-bold leading-tight tracking-tight">
            Create your agency workspace in minutes.
          </h2>
          <ul className="mt-8 space-y-3">
            {TRUST_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm leading-6 text-slate-200">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-xs font-bold text-teal-300">
                  ✓
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-400">
          © {new Date().getFullYear()} RE-OS. All rights reserved.
        </p>
      </section>

      <section className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-2xl">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-700 text-base font-bold text-white shadow-raised">
              RE
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-slate-900">RE-OS</p>
              <p className="text-xs text-slate-500">Premium real estate ops</p>
            </div>
          </div>

          <div className="panel p-7 sm:p-8">
            <p className="eyebrow">Sign up</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
              Start your agency trial
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Create the organization owner account and first tenant workspace.
            </p>
            <div className="mt-6">
              <SignupForm />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
