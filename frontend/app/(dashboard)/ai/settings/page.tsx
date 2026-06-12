'use client';

import { useEffect, useState } from 'react';

import { fetchAiSettings, updateAiSettings, type AiSettings } from '../../../../lib/ai';

const TOGGLES: { key: keyof AiSettings; label: string; help: string }[] = [
  { key: 'chat_enabled', label: 'Chat assistant', help: 'Enable the AI chat assistant for website + CRM.' },
  { key: 'voice_enabled', label: 'Voice agent', help: 'Allow initiating AI voice calls.' },
  { key: 'auto_qualify', label: 'Auto-qualify leads', help: 'Write qualification score + temperature back to CRM (BR-AI04).' },
  { key: 'auto_create_inquiry', label: 'Auto-create inquiries', help: 'Create CRM inquiries from captured leads.' },
  { key: 'auto_followups', label: 'Auto follow-ups', help: 'Generate follow-up suggestions after calls.' },
];

export default function AiSettingsPage() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [keywords, setKeywords] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAiSettings()
      .then((s) => {
        setSettings(s);
        setKeywords(s.handoff_keywords.join(', '));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load AI settings'));
  }, []);

  async function save(patch: Partial<AiSettings>) {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const next = await updateAiSettings(patch);
      setSettings(next);
      setKeywords(next.handoff_keywords.join(', '));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return <p className="text-sm text-slate-500">{error ?? 'Loading AI settings...'}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">AI settings</h1>
        <p className="text-sm text-slate-500">Provider, automation, and human-handoff configuration.</p>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {saved && <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">Saved.</div>}

      <section className="rounded-lg border bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-900">Provider</h2>
        <p className="mb-3 text-sm text-slate-500">
          All AI capabilities are provider-abstracted. <strong>mock</strong> runs fully offline (no API keys).
          Switch to <strong>openai</strong> once <code>OPENAI_API_KEY</code> is configured.
        </p>
        <select
          className="w-full max-w-xs rounded border px-3 py-2 text-sm"
          value={settings.provider}
          onChange={(e) => save({ provider: e.target.value })}
          disabled={saving}
        >
          <option value="mock">Mock (offline, deterministic)</option>
          <option value="openai">OpenAI</option>
        </select>
      </section>

      <section className="rounded-lg border bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-900">Automation</h2>
        <div className="space-y-3">
          {TOGGLES.map((t) => (
            <label key={t.key} className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(settings[t.key])}
                onChange={(e) => save({ [t.key]: e.target.checked } as Partial<AiSettings>)}
                disabled={saving}
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">{t.label}</span>
                <span className="block text-xs text-slate-500">{t.help}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-900">Human handoff keywords</h2>
        <p className="mb-3 text-xs text-slate-500">
          Comma-separated phrases that escalate an AI chat to a human advisor (BR-AI05).
        </p>
        <textarea
          className="w-full rounded border px-3 py-2 text-sm"
          rows={3}
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
        />
        <button
          type="button"
          className="mt-3 rounded bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          disabled={saving}
          onClick={() =>
            save({ handoff_keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean) })
          }
        >
          Save keywords
        </button>
      </section>
    </div>
  );
}
