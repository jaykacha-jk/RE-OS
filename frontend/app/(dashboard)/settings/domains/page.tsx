'use client';

import { FormEvent, useEffect, useState } from 'react';

import {
  addDomain,
  fetchDomains,
  removeDomain,
  verifyDomain,
  type CustomDomain,
} from '../../../../lib/settings';
import { ConfirmDialog, StatusBadge } from '../../../../components/ui';

const STATUS_STYLES: Record<string, string> = {
  verified: 'bg-green-100 text-green-700',
  active: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  provisioning: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
  primary: 'bg-teal-100 text-teal-800',
};

export default function DomainsPage() {
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<CustomDomain | null>(null);

  function load() {
    setLoading(true);
    fetchDomains()
      .then(setDomains)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!newDomain.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await addDomain(newDomain.trim());
      setNewDomain('');
      setExpanded(created.id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add domain');
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(id: string) {
    setBusy(true);
    setError(null);
    try {
      await verifyDomain(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    if (!removeTarget) return;
    setBusy(true);
    try {
      await removeDomain(removeTarget.id);
      setRemoveTarget(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Custom domains</h1>
      <p className="mt-1 text-sm text-slate-600">
        Connect a white-label domain (e.g. <code>abc-realty.com</code>). Add the DNS records, then verify.
      </p>

      <form onSubmit={onAdd} className="mt-4 flex gap-3">
        <input
          className="input flex-1"
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder="abc-realty.com"
        />
        <button type="submit" disabled={busy} className="btn-primary whitespace-nowrap">
          Add domain
        </button>
      </form>

      {error ? <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="mt-6 text-slate-500">Loading…</p> : null}

      <div className="mt-6 space-y-3">
        {!loading && domains.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No custom domains yet.
          </p>
        ) : null}

        {domains.map((d) => (
          <div key={d.id} className="rounded-lg border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{d.domain}</span>
                {d.is_primary ? <StatusBadge label="primary" className={STATUS_STYLES.primary} /> : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">verification</span>
                <StatusBadge label={d.verification_status} className={STATUS_STYLES[d.verification_status] ?? 'bg-slate-100 text-slate-600'} />
                <span className="text-xs text-slate-500">ssl</span>
                <StatusBadge label={d.ssl_status} className={STATUS_STYLES[d.ssl_status] ?? 'bg-slate-100 text-slate-600'} />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                  className="rounded border border-slate-300 px-3 py-1 text-sm"
                >
                  DNS
                </button>
                <button
                  type="button"
                  onClick={() => onVerify(d.id)}
                  disabled={busy}
                  className="rounded border border-teal-600 px-3 py-1 text-sm text-teal-700 disabled:opacity-50"
                >
                  Verify
                </button>
                <button
                  type="button"
                  onClick={() => setRemoveTarget(d)}
                  disabled={busy}
                  className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>

            {expanded === d.id ? (
              <div className="border-t border-slate-100 bg-slate-50 p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Add these DNS records at your registrar
                </p>
                <div className="scrollbar-thin overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="py-1 pr-4">Type</th>
                      <th className="py-1 pr-4">Host</th>
                      <th className="py-1">Value</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-slate-700">
                    {d.dns_records.map((r, i) => (
                      <tr key={i} className="border-t border-slate-200">
                        <td className="py-1 pr-4">{r.type}</td>
                        <td className="py-1 pr-4 break-all">{r.host}</td>
                        <td className="py-1 break-all">{r.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remove domain?"
        description={removeTarget ? `${removeTarget.domain} will be disconnected from your site.` : undefined}
        confirmLabel="Remove"
        danger
        loading={busy}
        onConfirm={onRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
