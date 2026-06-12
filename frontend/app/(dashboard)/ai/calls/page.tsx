'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  fetchAiCalls,
  initiateAiCall,
  temperatureColor,
  type AiCallSummary,
} from '../../../../lib/ai';

export default function AiCallsPage() {
  const [calls, setCalls] = useState<AiCallSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

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
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">AI call logs</h1>
        <p className="text-sm text-slate-500">
          Outbound + inbound AI calls with transcripts, sentiment, and qualification.
        </p>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

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
          {busy ? 'Calling…' : 'Initiate AI call'}
        </button>
        <p className="text-xs text-slate-400">Recording consent is disclosed in-call (BR-AI06).</p>
      </form>

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
                  No calls yet. Initiate one above.
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
