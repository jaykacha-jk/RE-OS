'use client';

import { useEffect, useState } from 'react';

import { fetchAiPrompts, upsertAiPrompt, type AiPrompt } from '../../../../lib/ai';

export default function AiPromptsPage() {
  const [prompts, setPrompts] = useState<AiPrompt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetchAiPrompts();
      setPrompts(res);
      setEditing(Object.fromEntries(res.map((p) => [p.key, p.system_prompt])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prompts');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(p: AiPrompt) {
    setSavingKey(p.key);
    setSaved(null);
    setError(null);
    try {
      await upsertAiPrompt({
        key: p.key,
        name: p.name,
        description: p.description ?? undefined,
        system_prompt: editing[p.key] ?? p.system_prompt,
      });
      setSaved(p.key);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Prompt templates</h1>
        <p className="text-sm text-slate-500">
          System prompts driving each AI capability. Edits create a tenant-scoped override.
        </p>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="space-y-4">
        {prompts.map((p) => (
          <div key={p.id} className="rounded-lg border bg-white p-5">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">{p.name}</h2>
                <p className="text-xs text-slate-500">
                  <code>{p.key}</code> · {p.scope === 'tenant' ? 'tenant override' : 'system default'}
                </p>
              </div>
              {saved === p.key && <span className="text-xs text-green-600">Saved</span>}
            </div>
            {p.description && <p className="mb-2 text-sm text-slate-500">{p.description}</p>}
            <textarea
              className="w-full rounded border px-3 py-2 font-mono text-xs"
              rows={6}
              value={editing[p.key] ?? ''}
              onChange={(e) => setEditing((prev) => ({ ...prev, [p.key]: e.target.value }))}
            />
            <button
              type="button"
              disabled={savingKey === p.key}
              onClick={() => save(p)}
              className="mt-2 rounded bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {savingKey === p.key ? 'Saving…' : 'Save override'}
            </button>
          </div>
        ))}
        {prompts.length === 0 && !error && <p className="text-sm text-slate-500">Loading prompts…</p>}
      </div>
    </div>
  );
}
