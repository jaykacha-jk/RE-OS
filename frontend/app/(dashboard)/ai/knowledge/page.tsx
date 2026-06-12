'use client';

import { FormEvent, useEffect, useState } from 'react';

import {
  createAiKnowledge,
  deleteAiKnowledge,
  fetchAiKnowledge,
  searchAiKnowledge,
  type AiKnowledgeDoc,
} from '../../../../lib/ai';

const TYPES = ['faq', 'policy', 'property', 'knowledge'];

export default function AiKnowledgePage() {
  const [docs, setDocs] = useState<AiKnowledgeDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('faq');
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; title: string; content: string; score: number }[] | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchAiKnowledge({ page: 1 });
      setDocs(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createAiKnowledge({ title, content, type });
      setTitle('');
      setContent('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteAiKnowledge(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  async function runSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    try {
      const res = await searchAiKnowledge(query);
      setResults(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Knowledge base</h1>
        <p className="text-sm text-slate-500">
          FAQs, policies, and docs powering RAG retrieval for the AI assistant.
        </p>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <section className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={create} className="space-y-3 rounded-lg border bg-white p-5">
          <h2 className="font-semibold text-slate-900">Add document</h2>
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="Title"
            value={title}
            required
            onChange={(e) => setTitle(e.target.value)}
          />
          <select className="w-full rounded border px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <textarea
            className="w-full rounded border px-3 py-2 text-sm"
            rows={5}
            placeholder="Content"
            value={content}
            required
            onChange={(e) => setContent(e.target.value)}
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add & embed'}
          </button>
        </form>

        <form onSubmit={runSearch} className="space-y-3 rounded-lg border bg-white p-5">
          <h2 className="font-semibold text-slate-900">Semantic search</h2>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="e.g. what is the brokerage fee?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="rounded border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Search
            </button>
          </div>
          {results && (
            <div className="space-y-2">
              {results.length === 0 && <p className="text-sm text-slate-500">No matches.</p>}
              {results.map((r) => (
                <div key={r.id} className="rounded border p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-800">{r.title}</span>
                    <span className="text-xs text-slate-400">{(r.score * 100).toFixed(0)}%</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-slate-500">{r.content}</p>
                </div>
              ))}
            </div>
          )}
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={5}>
                  Loading…
                </td>
              </tr>
            ) : docs.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={5}>
                  No documents yet.
                </td>
              </tr>
            ) : (
              docs.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-4 py-3 font-medium text-slate-800">{d.title}</td>
                  <td className="px-4 py-3 capitalize">{d.type}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{d.embedding_model ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(d.updated_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => remove(d.id)} className="text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
