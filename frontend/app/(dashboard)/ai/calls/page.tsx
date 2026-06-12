'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PageHeader } from '../../../../components/shared/PageHeader';
import {
  fetchAiCalls,
  initiateAiCall,
  isRealVoiceProviderAvailable,
  temperatureColor,
  type AiCallSummary,
} from '../../../../lib/ai';
import { getSession, hasPermission } from '../../../../lib/auth';

export default function AiCallsPage() {
  const [calls, setCalls] = useState<AiCallSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const voiceAvailable = isRealVoiceProviderAvailable();

  async function load() {
    setLoading(true);
    try {
      const res = await fetchAiCalls({ page: 1 });
      setCalls(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calls');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setCanCreate(hasPermission(getSession(), 'ai.calls.create'));
    load();
  }, []);

  async function placeCall(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await initiateAiCall({ client_phone: phone, client_name: name || undefined, consent_recorded: true });
      setPhone('');
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place call');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voice call logs"
        description="Demo call transcripts and rule-based qualification. Outbound calling is hidden until Exotel or Twilio is wired."
      />

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {canCreate && !voiceAvailable ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Real outbound voice is not enabled yet. Existing rows may come from mock/demo calls; the call button appears only when
          <code className="mx-1 rounded bg-white px-1 py-0.5">NEXT_PUBLIC_VOICE_PROVIDER</code>
          is set to a supported provider.
        </div>
      ) : null}

      {canCreate && voiceAvailable ? (
        <form onSubmit={placeCall} className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
          <div>
            <label className="block text-xs font-medium text-slate-500">Client phone</label>
            <input
              className="mt-1 rounded border px-3 py-2 text-sm"
              value={phone}
              required
              placeholder="+9198XXXXXXXX"
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Client name (optional)</label>
            <input
              className="mt-1 rounded border px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {busy ? 'Calling…' : 'Initiate voice call'}
          </button>
          <p className="text-xs text-slate-400">Recording consent is disclosed in-call (BR-AI06).</p>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Temp</th>
              <th className="px-4 py-3">Sentiment</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={8}>
                  Loading…
                </td>
              </tr>
            ) : calls.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={8}>
                  {voiceAvailable ? 'No calls yet. Initiate one above.' : 'No call logs yet. Real outbound calling is not enabled.'}
                </td>
              </tr>
            ) : (
              calls.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{c.client_name ?? c.client_phone}</p>
                    <p className="text-xs text-slate-500">{c.client_phone}</p>
                  </td>
                  <td className="px-4 py-3 capitalize">{c.direction}</td>
                  <td className="px-4 py-3 capitalize">{c.status}</td>
                  <td className="px-4 py-3">{c.qualification_score ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs capitalize ${temperatureColor(c.temperature)}`}>
                      {c.temperature ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize">{c.sentiment ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(c.created_at).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link className="text-teal-700 hover:underline" href={`/ai/calls/${c.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
