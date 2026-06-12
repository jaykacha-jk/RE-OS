import { Suspense } from 'react';

import { ResetPasswordForm } from './reset-password-form';

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Reset password</h1>
      <p className="mt-1 text-sm text-slate-600">
        Paste your reset token and choose a new password.
      </p>
      <div className="mt-6">
        <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
