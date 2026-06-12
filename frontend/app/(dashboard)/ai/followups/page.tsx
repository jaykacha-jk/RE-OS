'use client';

import { useEffect, useState } from 'react';

import {
  fetchAiFollowups,
  generateAiFollowups,
  updateAiFollowupStatus,
  type AiFollowup,
} from '../../../../lib/ai';

const PRIORITY_COLOR: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

export default function AiFollowupsPage() {
  const [rows, setRows] = useState<AiFollowup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchAiFollowups({ status: 'pending', page: 1 });
      setRows(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load follow-ups');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      await generateAiFollowups({});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: 'accepted' | 'dismissed' | 'applied') {
    try {
      await updateAiFollowupStatus(id, status);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Follow-up suggestions</h1>
          <p className="text-sm text-slate-500">
            Rule-based next actions for stale and high-intent inquiries.
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="rounded bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {busy ? 'Scanning…' : 'Scan inquiries'}
        </button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">No pending suggestions. Generate to scan inquiries.</p>
        ) : (
          rows.map((f) => (
            <div key={f.id} className="rounded-lg border bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs capitalize ${PRIORITY_COLOR[f.priority] ?? ''}`}>
                    {f.priority}
                  </span>
                  <span className="text-xs uppercase text-slate-400">{f.type} · {f.channel}</span>
                </div>
                {f.due_at && (
                  <span className="text-xs text-slate-500">Due {new Date(f.due_at).toLocaleDateString('en-IN')}</span>
                )}
              </div>
              <h3 className="mt-2 font-medium text-slate-800">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{f.message}</p>
              {f.reasoning && <p className="mt-1 text-xs italic text-slate-400">{f.reasoning}</p>}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setStatus(f.id, 'accepted')}
                  className="rounded border border-teal-600 px-3 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => setStatus(f.id, 'dismissed')}
                  className="rounded border px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
