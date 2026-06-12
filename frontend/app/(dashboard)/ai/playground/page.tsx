'use client';

import { useState } from 'react';

import {
  analyzeConversation,
  matchProperties,
  qualifyLead,
  sendAiChatMessage,
  startAiChat,
  temperatureColor,
  type AiChatReply,
  type IntelligenceResult,
  type MatchResult,
  type QualifyResult,
} from '../../../../lib/ai';

type Tab = 'qualify' | 'match' | 'intelligence' | 'chat';

const TABS: { id: Tab; label: string }[] = [
  { id: 'qualify', label: 'Qualify' },
  { id: 'match', label: 'Match' },
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'chat', label: 'Chat' },
];

export default function AiPlaygroundPage() {
  const [tab, setTab] = useState<Tab>('qualify');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">AI assistant</h1>
        <p className="text-sm text-slate-500">
          Run lead qualification, property matching, conversation intelligence, and the chat assistant.
        </p>
      </div>

      <div className="flex gap-2 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.id ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'qualify' && <QualifyTab />}
      {tab === 'match' && <MatchTab />}
      {tab === 'intelligence' && <IntelligenceTab />}
      {tab === 'chat' && <ChatTab />}
    </div>
  );
}

function QualifyTab() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<QualifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setResult(await qualifyLead({ text }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <textarea
          className="w-full rounded border px-3 py-2 text-sm"
          rows={8}
          placeholder="Paste lead message, e.g. 'Looking for a 3BHK in Whitefield, budget around 1.2 Cr, ready to buy in 2 months, need a home loan.'"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <RunButton onClick={run} busy={busy} label="Qualify lead" />
        {error && <ErrorBox msg={error} />}
      </Panel>
      <Panel>
        {result ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <span className={`rounded px-3 py-1 text-base font-semibold capitalize ${temperatureColor(result.temperature)}`}>
                {result.temperature}
              </span>
              <span className="text-2xl font-bold text-slate-900">{result.score}</span>
              <span className="text-slate-400">/ 100</span>
            </div>
            <KeyValues data={result.extracted} title="Extracted requirements" />
            <KeyValues data={result.breakdown} title="Score breakdown" />
          </div>
        ) : (
          <Empty />
        )}
      </Panel>
    </div>
  );
}

function MatchTab() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setResult(await matchProperties({ text, limit: 5 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Panel>
        <textarea
          className="w-full rounded border px-3 py-2 text-sm"
          rows={3}
          placeholder="Describe what the client wants, e.g. '2BHK apartment in Pune under 80 lakh'"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <RunButton onClick={run} busy={busy} label="Find matches" />
        {error && <ErrorBox msg={error} />}
      </Panel>
      {result && (
        <div className="space-y-3">
          {result.matches.length === 0 && <p className="text-sm text-slate-500">No matching properties found.</p>}
          {result.matches.map((m) => (
            <div key={m.property_id} className="rounded-lg border bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">{m.title}</p>
                  <p className="text-xs text-slate-500">
                    {m.property_code} · {m.city ?? '—'} · {m.bedrooms ?? '?'}BHK ·{' '}
                    {m.price ? `₹${m.price.toLocaleString('en-IN')}` : 'Price on request'}
                  </p>
                </div>
                <span className="rounded bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700">
                  {m.match_score}%
                </span>
              </div>
              {m.reasons.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs text-slate-500">
                  {m.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IntelligenceTab() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<IntelligenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setResult(await analyzeConversation({ text }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <textarea
          className="w-full rounded border px-3 py-2 text-sm"
          rows={10}
          placeholder="Paste a call transcript or chat log to analyze…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <RunButton onClick={run} busy={busy} label="Analyze" />
        {error && <ErrorBox msg={error} />}
      </Panel>
      <Panel>
        {result ? (
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs uppercase text-slate-400">Sentiment</span>
              <p className="font-medium capitalize text-slate-800">{result.sentiment}</p>
            </div>
            <p className="text-slate-700">{result.summary}</p>
            <SignalList title="Buying signals" items={result.buying_signals} color="text-green-700" />
            <SignalList title="Objections" items={result.objections} color="text-amber-700" />
            <SignalList title="Risk indicators" items={result.risk_indicators} color="text-red-700" />
            <SignalList title="Recommended actions" items={result.recommended_actions} color="text-teal-700" />
          </div>
        ) : (
          <Empty />
        )}
      </Panel>
    </div>
  );
}

function ChatTab() {
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [handoff, setHandoff] = useState(false);

  async function send() {
    if (!input.trim()) return;
    const message = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setBusy(true);
    setError(null);
    try {
      let reply: AiChatReply;
      if (!convId) {
        const res = await startAiChat({ message, channel: 'crm' });
        if ('reply' in res) {
          reply = res;
        } else {
          setConvId(res.ai_conversation_id);
          reply = await sendAiChatMessage(res.ai_conversation_id, message);
        }
        setConvId(reply.ai_conversation_id);
      } else {
        reply = await sendAiChatMessage(convId, message);
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: reply.reply }]);
      if (reply.handoff_requested) setHandoff(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <div className="mb-3 h-80 space-y-2 overflow-y-auto rounded border bg-slate-50 p-3">
        {messages.length === 0 && <p className="text-sm text-slate-400">Start a conversation with the AI assistant.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                m.role === 'user' ? 'bg-teal-600 text-white' : 'bg-white text-slate-800 shadow-sm'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>
      {handoff && (
        <div className="mb-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          Human handoff requested — a live advisor should take over this conversation.
        </div>
      )}
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2 text-sm"
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !busy) send();
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={busy}
          className="rounded bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3 rounded-lg border bg-white p-5">{children}</div>;
}

function RunButton({ onClick, busy, label }: { onClick: () => void; busy: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="rounded bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
    >
      {busy ? 'Running…' : label}
    </button>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{msg}</div>;
}

function Empty() {
  return <p className="text-sm text-slate-400">Results will appear here.</p>;
}

function KeyValues({ data, title }: { data: Record<string, unknown>; title: string }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs uppercase text-slate-400">{title}</p>
      <div className="grid grid-cols-2 gap-1 text-sm">
        {entries.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2 rounded bg-slate-50 px-2 py-1">
            <span className="text-slate-500">{k.replace(/_/g, ' ')}</span>
            <span className="font-medium text-slate-800">{String(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignalList({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className={`mb-1 text-xs font-semibold uppercase ${color}`}>{title}</p>
      <ul className="list-inside list-disc text-sm text-slate-600">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
