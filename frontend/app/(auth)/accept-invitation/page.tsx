import { Suspense } from 'react';

import { AcceptInvitationForm } from './accept-invitation-form';

export default function AcceptInvitationPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Accept invitation</h1>
      <p className="mt-1 text-sm text-slate-600">
        Set your password to activate your RE-OS account.
      </p>
      <div className="mt-6">
        <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
          <AcceptInvitationForm />
        </Suspense>
      </div>
    </main>
  );
}
