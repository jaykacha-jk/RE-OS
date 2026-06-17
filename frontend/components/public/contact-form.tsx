'use client';

import { FormEvent, useState } from 'react';

import { PhoneInput } from '../ui/PhoneInput';
import { API_BASE } from '../../lib/public-site';
import { isValidIndianMobile, parseNationalDigits, toE164 } from '../../lib/phone';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export function ContactForm({ tenant }: { tenant: string }) {
  const [state, setState] = useState<SubmitState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    if (!isValidIndianMobile(parseNationalDigits(phone))) {
      setError('Please match the requested format.');
      setState('error');
      return;
    }

    setState('submitting');
    setError(null);

    const payload = {
      client_name: String(form.get('client_name') ?? ''),
      phone: toE164(parseNationalDigits(phone)),
      email: String(form.get('email') ?? '') || undefined,
      preferred_location: String(form.get('preferred_location') ?? '') || undefined,
      message: String(form.get('message') ?? '') || undefined,
    };

    try {
      const response = await fetch(
        `${API_BASE}/api/v1/public/${encodeURIComponent(tenant)}/inquiries`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(body?.error?.message ?? 'Could not send your message. Please try again.');
        setState('error');
        return;
      }

      setState('success');
    } catch {
      setError('Network error. Please check your connection and try again.');
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <div className="card p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-6 w-6">
            <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-950">Message sent</h2>
        <p className="mt-2 text-sm text-slate-600">
          Thanks for reaching out. Our team will get back to you shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card p-6 sm:p-8">
      <h2 className="text-xl font-bold text-slate-950">Send us a message</h2>
      <p className="mt-1 text-sm text-slate-600">
        Fill in your details and the team will call you back.
      </p>

      <div className="mt-6 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Full name *</span>
            <input name="client_name" required minLength={2} placeholder="Your name" className="input mt-1.5" />
          </label>
          <div>
            <span className="text-sm font-semibold text-slate-700">Phone *</span>
            <div className="mt-1.5">
              <PhoneInput value={phone} onChange={setPhone} required className="input" />
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Email</span>
            <input name="email" type="email" placeholder="you@example.com" className="input mt-1.5" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Preferred location</span>
            <input name="preferred_location" placeholder="e.g. SG Highway, Ahmedabad" className="input mt-1.5" />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Message</span>
          <textarea
            name="message"
            rows={4}
            placeholder="Tell us what you're looking for…"
            className="input mt-1.5 resize-y"
          />
        </label>
      </div>

      {state === 'error' && error ? (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>
      ) : null}

      <button type="submit" disabled={state === 'submitting'} className="btn-primary mt-6 w-full py-2.5">
        {state === 'submitting' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
