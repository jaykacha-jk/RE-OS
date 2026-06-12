'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { fetchAiCall, temperatureColor, type AiCallDetail } from '../../../../../lib/ai';

export default function AiCallDetailPage() {
  const params = useParams<{ id: string }>();
  const [call, setCall] = useState<AiCallDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    fetchAiCall(params.id)
      .then(setCall)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load call'));
  }, [params?.id]);

  if (error) return <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>;
  if (!call) return <p className="text-sm text-slate-500">Loading call…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/ai/calls" className="text-sm text-teal-700 hover:underline">
            ← Back to call logs
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {call.client_name ?? call.client_phone}
          </h1>
          <p className="text-sm text-slate-500">
            {call.direction} · {call.status} · {call.provider} · {call.duration_seconds}s
          </p>
        </div>
        <span className={`rounded px-3 py-1 text-sm capitalize ${temperatureColor(call.temperature)}`}>
          {call.temperature ?? 'unscored'} · {call.qualification_score ?? '—'}
        </span>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <Info label="Sentiment" value={call.sentiment ?? '—'} />
        <Info label="Next action" value={call.next_action ?? '—'} />
        <Info label="Linked inquiry" value={call.inquiry_id ?? 'Not linked'} />
      </section>

      {call.summary && (
        <section className="rounded-lg border bg-white p-5">
          <h2 className="mb-2 font-semibold text-slate-900">AI summary</h2>
          <p className="text-sm text-slate-700">{call.summary}</p>
        </section>
      )}

      <section className="rounded-lg border bg-white p-5">
        <h2 className="mb-4 font-semibold text-slate-900">Transcript</h2>
        {call.segments.length ? (
          <div className="space-y-3">
            {call.segments.map((s, i) => (
              <div key={i} className={`flex ${s.speaker === 'client' ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    s.speaker === 'client' ? 'bg-slate-100 text-slate-800' : 'bg-teal-50 text-teal-900'
                  }`}
                >
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {s.speaker}
                    {s.sentiment ? ` · ${s.sentiment}` : ''}
                  </p>
                  {s.content}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No transcript captured.</p>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
