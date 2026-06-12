import Link from 'next/link';
import { Suspense } from 'react';

import { LoginForm } from './login-form';

const TRUST_POINTS = [
  'Multi-tenant CRM, inventory, chat, billing & analytics in one workspace',
  'Role-based access with full tenant isolation',
  'Built for Indian real estate — INR, +91, Gujarat market-ready',
];

export default function LoginPage() {
  return (
    <main className="premium-gradient flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-teal-900 via-slate-900 to-slate-950 px-10 py-12 text-white lg:flex lg:w-1/2 lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500 text-lg font-bold text-white shadow-raised">
            RE
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight">RE-OS</p>
            <p className="text-xs text-slate-300">Premium real estate operating system</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Operate with confidence</p>
          <h2 className="mt-4 text-4xl font-bold leading-tight tracking-tight">
            The command center for serious real estate teams.
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

        <p className="relative text-xs text-slate-400">© {new Date().getFullYear()} RE-OS. All rights reserved.</p>
      </section>

      {/* Form panel */}
      <section className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
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
            <p className="eyebrow">Sign in</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-500">Admin and platform access to your workspace.</p>
            <div className="mt-6">
              <Suspense fallback={<p className="text-sm text-slate-500">Loading sign in...</p>}>
                <LoginForm />
              </Suspense>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50/60 px-4 py-3 text-xs leading-5 text-teal-900">
            <span className="font-bold">Demo access:</span> use <code className="font-mono">owner@demo.realty</code> with slug{' '}
            <code className="font-mono">demo</code>, or leave the slug blank for Super Admin (<code className="font-mono">super@reos.dev</code>).
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            New to RE-OS?{' '}
            <Link href="/signup" className="font-semibold text-teal-700 hover:underline">
              Create an agency account
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
