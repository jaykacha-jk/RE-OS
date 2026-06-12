'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { apiFetch } from '../../../lib/api';
import { saveSession, type AuthSession } from '../../../lib/auth';

type AcceptResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: AuthSession['user'];
};

export function AcceptInvitationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('token') ?? '';

  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    if (!token.trim()) {
      setError('Invitation token is required');
      return;
    }

    setLoading(true);
    try {
      const { data } = await apiFetch<AcceptResponse>('/api/v1/auth/accept-invitation', {
        method: 'POST',
        body: JSON.stringify({ token: token.trim(), password }),
      });

      saveSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        user: data.user,
      });

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept invitation');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="token" className="block text-sm font-medium text-slate-700">
          Invitation token
        </label>
        <input
          id="token"
          type="text"
          required
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
          placeholder="Paste token from invite link"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          New password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="confirm" className="block text-sm font-medium text-slate-700">
          Confirm password
        </label>
        <input
          id="confirm"
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
        />
      </div>

      {error ? (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-teal-700 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {loading ? 'Activating…' : 'Activate account'}
      </button>

      <p className="text-center text-sm text-slate-600">
        <Link href="/login" className="text-teal-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
