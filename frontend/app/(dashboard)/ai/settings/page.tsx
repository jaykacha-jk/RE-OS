'use client';

import { useEffect, useState } from 'react';

import { LoadingState } from '../../../../components/shared/LoadingState';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { fetchAiSettings, isRealVoiceProviderAvailable, updateAiSettings, type AiSettings } from '../../../../lib/ai';
import { getSession, hasPermission } from '../../../../lib/auth';

const TOGGLES: { key: keyof AiSettings; label: string; help: string }[] = [
  { key: 'chat_enabled', label: 'LLM chat assistant', help: 'Uses OpenAI only when the provider and API key are configured; otherwise mock replies are used.' },
  { key: 'voice_enabled', label: 'Voice calling', help: 'Hidden until a real Exotel or Twilio telephony provider is wired.' },
  { key: 'auto_qualify', label: 'Rule-based lead scoring', help: 'Writes deterministic qualification score + temperature back to CRM (BR-AI04).' },
  { key: 'auto_create_inquiry', label: 'Auto-create inquiries', help: 'Create CRM inquiries from captured leads.' },
  { key: 'auto_followups', label: 'Rule-based follow-ups', help: 'Generate stale-lead follow-up suggestions from deterministic rules.' },
];

export default function AiSettingsPage() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [keywords, setKeywords] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const voiceAvailable = isRealVoiceProviderAvailable();

  useEffect(() => {
    setCanManage(hasPermission(getSession(), 'ai.settings.manage'));
    fetchAiSettings()
      .then((s) => {
        setSettings(s);
        setKeywords(s.handoff_keywords.join(', '));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load AI settings'));
  }, []);

  async function save(patch: Partial<AiSettings>) {
    if (!canManage) return;
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
    return error ? (
      <p className="text-sm text-slate-500">{error}</p>
    ) : (
      <LoadingState title="Loading AI settings..." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assistant settings"
        description="Provider, rule automation, and human-handoff configuration."
      />

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {saved && <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">Saved.</div>}

      <section className="rounded-lg border bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-900">Provider</h2>
        <p className="mb-3 text-sm text-slate-500">
          Chat, embeddings, and transcription are provider-abstracted. <strong>mock</strong> runs offline with deterministic data.
          <strong> openai</strong> uses real LLM/RAG paths once <code>OPENAI_API_KEY</code> is configured.
          Qualification, matching, and follow-ups remain rule-based engines.
        </p>
        <select
          className="w-full max-w-xs rounded border px-3 py-2 text-sm"
          value={settings.provider}
          onChange={(e) => save({ provider: e.target.value })}
          disabled={saving || !canManage}
        >
          <option value="mock">Mock (offline, deterministic)</option>
          <option value="openai">OpenAI</option>
        </select>
      </section>

      <section className="rounded-lg border bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-900">Automation</h2>
        <div className="space-y-3">
          {TOGGLES.map((t) => {
            const disabled = saving || !canManage || (t.key === 'voice_enabled' && !voiceAvailable);
            return (
            <label key={t.key} className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(settings[t.key])}
                onChange={(e) => save({ [t.key]: e.target.checked } as Partial<AiSettings>)}
                disabled={disabled}
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">{t.label}</span>
                <span className="block text-xs text-slate-500">{t.help}</span>
              </span>
            </label>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-900">Human handoff keywords</h2>
        <p className="mb-3 text-xs text-slate-500">
          Comma-separated phrases that escalate assistant chat to a human advisor (BR-AI05).
        </p>
        <textarea
          className="w-full rounded border px-3 py-2 text-sm"
          rows={3}
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          disabled={!canManage}
        />
        <button
          type="button"
          className="mt-3 rounded bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          disabled={saving || !canManage}
          onClick={() =>
            save({ handoff_keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean) })
          }
        >
          Save keywords
        </button>
        {!canManage ? (
          <p className="mt-2 text-xs text-slate-500">You do not have permission to change AI settings.</p>
        ) : null}
      </section>
    </div>
  );
}
