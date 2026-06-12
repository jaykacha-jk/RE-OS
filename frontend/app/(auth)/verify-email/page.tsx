import { Suspense } from 'react';
import Link from 'next/link';

import { VerifyEmailForm } from './verify-email-form';

export default function VerifyEmailPage() {
  return (
    <main className="premium-gradient flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-700 text-base font-bold text-white shadow-raised">
            RE
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight text-slate-900">RE-OS</p>
            <p className="text-xs text-slate-500">Premium real estate ops</p>
          </div>
        </Link>

        <div className="panel p-7 sm:p-8">
          <p className="eyebrow">Email verification</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            Verify your email
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Confirm your owner account before signing in to the dashboard.
          </p>
          <div className="mt-6">
            <Suspense fallback={<p className="text-sm text-slate-500">Loading token...</p>}>
              <VerifyEmailForm />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
