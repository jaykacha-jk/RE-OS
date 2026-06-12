'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { apiFetch } from '../../../lib/api';

type VerifyEmailResponse = {
  message: string;
  user: {
    id: string;
    email: string;
    email_verified_at: string | null;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState(searchParams.get('token') ?? '');
  const [result, setResult] = useState<VerifyEmailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!token.trim()) {
      setError('Verification token is required');
      return;
    }

    setLoading(true);
    try {
      const { data } = await apiFetch<VerifyEmailResponse>('/api/v1/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: token.trim() }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email verification failed');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    const loginHref = result.organization
      ? `/login?tenant_slug=${encodeURIComponent(result.organization.slug)}`
      : '/login';

    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
          <p className="font-bold">Email verified</p>
          <p className="mt-1">{result.message}</p>
          {result.organization ? (
            <p className="mt-3 text-xs">
              Workspace:{' '}
              <span className="font-mono font-semibold">{result.organization.slug}</span>
            </p>
          ) : null}
        </div>
        <Link href={loginHref} className="btn-primary w-full">
          Sign in to dashboard
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="token" className="block text-sm font-medium text-slate-700">
          Verification token
        </label>
        <input
          id="token"
          type="text"
          required
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="input mt-1 font-mono text-xs"
          placeholder="Paste token from verification email"
        />
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Verifying...' : 'Verify email'}
      </button>

      <p className="text-center text-sm text-slate-600">
        Need a new account?{' '}
        <Link href="/signup" className="text-teal-700 hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
