'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';

import { apiFetch } from '../../../lib/api';

type RegisterResponse = {
  organization: {
    id: string;
    name: string;
    slug: string;
    status: string;
    tier: string;
    trial_ends_at: string | null;
  };
  owner: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    email_verified_at: string | null;
  };
  subscription: {
    id: string;
    status: string;
    plan_code: string;
    billing_cycle: string;
    trial_ends_at: string | null;
  };
  verification_email_sent: boolean;
  url?: string;
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

export function SignupForm() {
  const [agencyName, setAgencyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+91');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RegisterResponse | null>(null);

  const suggestedSlug = useMemo(() => slugify(agencyName), [agencyName]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { data } = await apiFetch<RegisterResponse>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          agency_name: agencyName,
          owner_name: ownerName,
          email,
          password,
          phone,
        }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
          <p className="font-bold">Agency account created</p>
          <p className="mt-1">
            We sent a verification email to <span className="font-semibold">{result.owner.email}</span>.
          </p>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-semibold uppercase tracking-wide text-emerald-700">Workspace slug</dt>
              <dd className="font-mono">{result.organization.slug}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-emerald-700">Trial ends</dt>
              <dd>{result.subscription.trial_ends_at ? new Date(result.subscription.trial_ends_at).toLocaleDateString() : 'Trial active'}</dd>
            </div>
          </dl>
        </div>

        {result.url ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-bold">Dev verification link</p>
            <Link href={result.url} className="mt-1 block break-all font-mono text-xs underline">
              {result.url}
            </Link>
          </div>
        ) : null}

        <Link href="/login" className="btn-primary w-full">
          Continue to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="agency_name" className="block text-sm font-medium text-slate-700">
          Agency name
        </label>
        <input
          id="agency_name"
          type="text"
          required
          minLength={2}
          maxLength={120}
          value={agencyName}
          onChange={(e) => setAgencyName(e.target.value)}
          className="input mt-1"
          placeholder="Aarav Prime Realty"
        />
        {suggestedSlug ? (
          <p className="mt-1 text-xs text-slate-500">
            Workspace slug: <span className="font-mono">{suggestedSlug}</span>
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="owner_name" className="block text-sm font-medium text-slate-700">
          Owner name
        </label>
        <input
          id="owner_name"
          type="text"
          required
          minLength={2}
          maxLength={120}
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          className="input mt-1"
          placeholder="Aarav Mehta"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
            className="input mt-1"
            placeholder="owner@agency.in"
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
            Phone
          </label>
          <input
            id="phone"
            type="tel"
            required
            pattern="^\+91[6-9]\d{9}$"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input mt-1"
            placeholder="+919876543210"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input mt-1"
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
            className="input mt-1"
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Creating workspace...' : 'Create agency account'}
      </button>

      <p className="text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="text-teal-700 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
