'use client';

import { useState } from 'react';

import { API_BASE } from '../../lib/public-site';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export function PropertyInquiryForm({
  tenant,
  propertySlug,
  requirementType,
  preferredLocation,
}: {
  tenant: string;
  propertySlug: string;
  requirementType: string;
  preferredLocation: string;
}) {
  const [state, setState] = useState<SubmitState>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setState('submitting');
    setError(null);

    const payload = {
      client_name: String(formData.get('client_name') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      email: String(formData.get('email') ?? '') || undefined,
      property_slug: propertySlug,
      requirement_type: requirementType,
      preferred_location: preferredLocation,
      message: String(formData.get('message') ?? '') || undefined,
    };

    const response = await fetch(`${API_BASE}/api/v1/public/${encodeURIComponent(tenant)}/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? 'Could not submit inquiry. Please try again.');
      setState('error');
      return;
    }

    setState('success');
  }

  return (
    <form action={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Interested in this property?</h2>
      <p className="mt-1 text-sm text-slate-600">Share your details and the team will call you back.</p>

      <div className="mt-4 grid gap-3">
        <input
          name="client_name"
          required
          minLength={2}
          placeholder="Full name"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="phone"
          required
          minLength={5}
          placeholder="+91 phone number"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="email"
          type="email"
          placeholder="Email (optional)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <textarea
          name="message"
          rows={3}
          placeholder="Message (optional)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={state === 'submitting' || state === 'success'}
        className="mt-4 w-full rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {state === 'submitting' ? 'Submitting...' : state === 'success' ? 'Inquiry sent' : 'Request callback'}
      </button>

      {state === 'success' ? (
        <p className="mt-3 text-sm font-medium text-emerald-700">Thanks. We will contact you shortly.</p>
      ) : null}
      {state === 'error' && error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
    </form>
  );
}
