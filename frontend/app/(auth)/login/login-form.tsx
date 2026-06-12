'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { apiFetch } from '../../../lib/api';
import { saveSession, type AuthSession } from '../../../lib/auth';

type LoginResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: AuthSession['user'];
};

type DevCredential = {
  label: string;
  description: string;
  email: string;
  password: string;
  tenantSlug: string;
};

const IS_DEV = process.env.NODE_ENV !== 'production';

const DEV_CREDENTIALS: DevCredential[] = [
  {
    label: 'Super Admin',
    description: 'Platform-wide access',
    email: 'super@reos.dev',
    password: 'ChangeMe123!',
    tenantSlug: '',
  },
  {
    label: 'Demo Org Owner',
    description: 'Tenant: demo',
    email: 'owner@demo.realty',
    password: 'ChangeMe123!',
    tenantSlug: 'demo',
  },
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function fillCredential(cred: DevCredential) {
    setEmail(cred.email);
    setPassword(cred.password);
    setTenantSlug(cred.tenantSlug);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload: Record<string, string> = { email, password };
      if (tenantSlug.trim()) {
        payload.tenant_slug = tenantSlug.trim().toLowerCase();
      }

      const { data } = await apiFetch<LoginResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      saveSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        user: data.user,
      });

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
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
          className="input mt-1"
          placeholder="super@reos.dev"
        />
      </div>

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
        <label htmlFor="tenant_slug" className="block text-sm font-medium text-slate-700">
          Organization slug (tenant login only)
        </label>
        <input
          id="tenant_slug"
          type="text"
          value={tenantSlug}
          onChange={(e) => setTenantSlug(e.target.value)}
          className="input mt-1"
          placeholder="demo"
        />
        <p className="mt-1 text-xs text-slate-500">
          Leave empty for Super Admin. Use <code>demo</code> for seeded org owner.
        </p>
      </div>

      {IS_DEV ? (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/70 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
            Dev mode · click to autofill
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {DEV_CREDENTIALS.map((cred) => (
              <button
                key={cred.email}
                type="button"
                onClick={() => fillCredential(cred)}
                className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-left transition hover:border-amber-400 hover:bg-amber-50"
              >
                <span className="block text-sm font-semibold text-slate-800">{cred.label}</span>
                <span className="block font-mono text-xs text-slate-500">{cred.email}</span>
                <span className="block text-xs text-amber-700">{cred.description}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>
      ) : null}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="text-center text-sm text-slate-600">
        <Link href="/forgot-password" className="text-teal-700 hover:underline">
          Forgot password?
        </Link>
      </p>
    </form>
  );
}
