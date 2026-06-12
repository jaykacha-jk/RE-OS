'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

import { apiFetch } from '../../../lib/api';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setResetUrl(null);
    setLoading(true);

    try {
      const payload: Record<string, string> = { email };
      if (tenantSlug.trim()) {
        payload.tenant_slug = tenantSlug.trim().toLowerCase();
      }

      const { data } = await apiFetch<{ message: string; url?: string }>(
        '/api/v1/auth/forgot-password',
        {
        method: 'POST',
        body: JSON.stringify(payload),
        },
      );

      setMessage(data.message);
      setResetUrl(data.url ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="tenant_slug" className="block text-sm font-medium text-slate-700">
          Organization slug (optional)
        </label>
        <input
          id="tenant_slug"
          type="text"
          value={tenantSlug}
          onChange={(e) => setTenantSlug(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          placeholder="demo"
        />
      </div>

      {error ? (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {message ? (
        <div className="rounded bg-teal-50 px-3 py-2 text-sm text-teal-900">
          <p>{message}</p>
          {resetUrl ? (
            <Link href={resetUrl} className="mt-1 block break-all font-mono text-xs underline">
              {resetUrl}
            </Link>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-teal-700 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {loading ? 'Sending…' : 'Send reset link'}
      </button>

      <p className="text-center text-sm text-slate-600">
        <Link href="/login" className="text-teal-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
