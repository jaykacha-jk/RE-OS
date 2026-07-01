'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';

import { FormField, FormSection, Icon, PageHeader } from '../../../../components/ui';
import { getSession, hasPermission } from '../../../../lib/auth';
import {
  fetchRazorpayPlatformConfig,
  updateRazorpayPlatformConfig,
  type RazorpayPlatformConfigMasked,
} from '../../../../lib/platform-payment-config';

type FormState = {
  key_id: string;
  key_secret: string;
  webhook_secret: string;
  environment: 'test' | 'live';
  active: boolean;
};

const EMPTY_FORM: FormState = {
  key_id: '',
  key_secret: '',
  webhook_secret: '',
  environment: 'test',
  active: false,
};

export default function PlatformPaymentsPage() {
  const [config, setConfig] = useState<RazorpayPlatformConfigMasked | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canUpdate = hasPermission(getSession(), 'platform.payment_providers.update');

  useEffect(() => {
    fetchRazorpayPlatformConfig()
      .then((data) => {
        setConfig(data);
        setForm((prev) => ({
          ...prev,
          environment: data.environment,
          active: data.active,
        }));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load payment settings'))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUpdate || saving) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        environment: form.environment,
        active: form.active,
        ...(form.key_id.trim() ? { key_id: form.key_id.trim() } : {}),
        ...(form.key_secret.trim() ? { key_secret: form.key_secret.trim() } : {}),
        ...(form.webhook_secret.trim() ? { webhook_secret: form.webhook_secret.trim() } : {}),
      };
      const updated = await updateRazorpayPlatformConfig(payload);
      setConfig(updated);
      setForm((prev) => ({
        ...prev,
        key_id: '',
        key_secret: '',
        webhook_secret: '',
        environment: updated.environment,
        active: updated.active,
      }));
      setSuccess('Razorpay configuration saved. Secrets are encrypted at rest and never shown again.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save payment settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Payment providers"
        description="Manage platform Razorpay credentials for live billing. Secrets are stored encrypted and never returned to the browser after save."
        actions={
          <Link href="/platform/billing" className="btn-secondary">
            <Icon name="performance" className="h-4 w-4" /> Revenue metrics
          </Link>
        }
      />

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}
      {success ? (
        <p className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">{success}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading payment configuration…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <FormSection title="Razorpay" description="Single platform account for all tenant subscriptions (launch model A).">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Environment">
                  <select
                    value={form.environment}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        environment: event.target.value as 'test' | 'live',
                      }))
                    }
                    disabled={!canUpdate}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="test">Test</option>
                    <option value="live">Live</option>
                  </select>
                </FormField>

                <FormField label="Active">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
                      disabled={!canUpdate}
                    />
                    Use these credentials for live checkout
                  </label>
                </FormField>
              </div>

              <FormField
                label="Key ID"
                hint={config?.key_id_masked ? `Current: ${config.key_id_masked}` : 'Leave blank to keep existing value'}
              >
                <input
                  type="text"
                  value={form.key_id}
                  onChange={(event) => setForm((prev) => ({ ...prev, key_id: event.target.value }))}
                  disabled={!canUpdate}
                  placeholder="rzp_test_..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
                />
              </FormField>

              <FormField
                label="Key secret"
                hint={
                  config?.key_secret_configured
                    ? 'Configured — enter only to rotate'
                    : 'Required when active'
                }
              >
                <input
                  type="password"
                  value={form.key_secret}
                  onChange={(event) => setForm((prev) => ({ ...prev, key_secret: event.target.value }))}
                  disabled={!canUpdate}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
                />
              </FormField>

              <FormField
                label="Webhook secret"
                hint={
                  config?.webhook_secret_configured
                    ? 'Configured — enter only to rotate'
                    : 'Required when active'
                }
              >
                <input
                  type="password"
                  value={form.webhook_secret}
                  onChange={(event) => setForm((prev) => ({ ...prev, webhook_secret: event.target.value }))}
                  disabled={!canUpdate}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
                />
              </FormField>
            </FormSection>

            {canUpdate ? (
              <button type="submit" disabled={saving} className="btn-primary mt-4">
                {saving ? 'Saving…' : 'Save Razorpay configuration'}
              </button>
            ) : (
              <p className="mt-4 text-sm text-slate-500">You have read-only access to payment provider settings.</p>
            )}
          </form>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Current status</p>
              <ul className="mt-3 space-y-2">
                <li>
                  Source: <span className="font-medium">{config?.source ?? 'none'}</span>
                </li>
                <li>
                  Version: <span className="font-medium">{config?.version ?? '—'}</span>
                </li>
                <li>
                  Last updated:{' '}
                  <span className="font-medium">
                    {config?.updated_at ? new Date(config.updated_at).toLocaleString() : '—'}
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              <p className="font-semibold">Before going live</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Set `PLATFORM_SECRETS_ENCRYPTION_KEY` on the API server</li>
                <li>Point Razorpay webhooks to `/api/v1/billing/webhooks/razorpay`</li>
                <li>Set `BILLING_LAUNCH_MODE=live` and `PAYMENT_PROVIDER=razorpay`</li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
