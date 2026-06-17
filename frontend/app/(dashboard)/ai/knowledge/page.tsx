'use client';

import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react';

import {
  ActionMenu,
  ConfirmDialog,
  CrudToolbar,
  DataTable,
  EmptyState,
  FilterDrawer,
  FilterField,
  FormDrawer,
  FormField,
  FormSection,
  Icon,
  PageHeader,
  Pagination,
  type DataTableColumn,
} from '../../../../components/ui';
import { useTableQuery, type TableQueryValues } from '../../../../hooks/use-table-query';
import {
  createAiKnowledge,
  deleteAiKnowledge,
  fetchAiKnowledge,
  searchAiKnowledge,
  type AiKnowledgeDoc,
} from '../../../../lib/ai';
import { getSession, hasPermission } from '../../../../lib/auth';

const TYPES = ['faq', 'policy', 'property', 'document'];

export default function AiKnowledgePage() {
  return (
    <Suspense fallback={null}>
      <AiKnowledgeInner />
    </Suspense>
  );
}

const FILTER_KEYS = ['type'];

function AiKnowledgeInner() {
  const tableQuery = useTableQuery({ filterKeys: FILTER_KEYS });
  const [docs, setDocs] = useState<AiKnowledgeDoc[]>([]);
  const [meta, setMeta] = useState<{ page: number; total_pages: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<TableQueryValues>(tableQuery.filters);
  const [deleteTarget, setDeleteTarget] = useState<AiKnowledgeDoc | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('faq');
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; title: string; content: string; score: number }[] | null>(null);
  const { filters, search, page, setPage, perPage, setPerPage } = tableQuery;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAiKnowledge({ page, per_page: perPage, search: search || undefined, type: filters.type || undefined });
      setDocs(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge');
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search, filters.type]);

  useEffect(() => {
    setCanManage(hasPermission(getSession(), 'ai.knowledge.manage'));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setSaving(true);
    setFormError(null);
    try {
      await createAiKnowledge({ title, content, type });
      setTitle('');
      setContent('');
      setDrawerOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create document');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAiKnowledge(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
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

  const columns: DataTableColumn<AiKnowledgeDoc>[] = [
    { key: 'title', header: 'Title', render: (doc) => <span className="font-semibold text-slate-900">{doc.title}</span> },
    { key: 'type', header: 'Type', render: (doc) => <span className="capitalize text-slate-700">{doc.type}</span> },
    { key: 'model', header: 'Model', render: (doc) => <span className="font-mono text-2xs text-slate-500">{doc.embedding_model ?? '—'}</span> },
    { key: 'updated', header: 'Updated', cellClassName: 'text-slate-500', render: (doc) => new Date(doc.updated_at).toLocaleDateString('en-IN') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge base"
        description="FAQs, policies, and docs powering RAG retrieval for the assistant when OpenAI is configured."
      />

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <section>
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

      <section className="overflow-hidden rounded-2xl border border-reos-border bg-white shadow-card">
        <CrudToolbar
          searchValue={tableQuery.searchInput}
          onSearchChange={tableQuery.setSearchInput}
          searchPlaceholder="Search documents"
          onFilter={() => {
            setDraft(filters);
            setFilterOpen(true);
          }}
          filterCount={tableQuery.activeFilterCount}
          onRefresh={load}
          refreshing={loading}
          addSlot={
            canManage ? (
              <button type="button" className="btn-primary" onClick={() => setDrawerOpen(true)}>
                <Icon name="plus" className="h-4 w-4" /> Add document
              </button>
            ) : null
          }
        />

        <DataTable<AiKnowledgeDoc>
          columns={columns}
          rows={docs}
          rowKey={(doc) => doc.id}
          loading={loading}
          empty={<EmptyState title="No documents found" description="Add FAQs, policies, and docs to power assistant retrieval." />}
          actions={
            canManage
              ? (doc) => (
                  <ActionMenu
                    items={[
                      {
                        label: 'Delete',
                        danger: true,
                        onSelect: () => setDeleteTarget(doc),
                      },
                    ]}
                  />
                )
              : undefined
          }
        />

        {meta ? (
          <Pagination
            page={meta.page}
            totalPages={meta.total_pages}
            total={meta.total}
            perPage={perPage}
            onPageChange={setPage}
            onPerPageChange={setPerPage}
          />
        ) : null}
      </section>

      <FilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={() => tableQuery.applyFilters(draft)}
        onClear={() => {
          tableQuery.clearFilters();
          setDraft(Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])));
        }}
      >
        <FilterField label="Type">
          <select value={draft.type ?? ''} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))} className="input">
            <option value="">All types</option>
            {TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterDrawer>

      <FormDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setFormError(null);
        }}
        title="Add knowledge document"
        description="Create and embed content for AI retrieval."
        onSubmit={create}
        submitting={saving}
        error={formError}
        submitLabel="Add and embed"
      >
        <FormSection title="Document" description="Keep content focused so retrieval can return useful context.">
          <FormField label="Title" required full>
            <input className="input" value={title} required onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField label="Type" required full>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Content" required full>
            <textarea className="input min-h-40" value={content} required onChange={(e) => setContent(e.target.value)} />
          </FormField>
        </FormSection>
      </FormDrawer>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete knowledge document?"
        description={deleteTarget ? `${deleteTarget.title} will be removed from assistant retrieval.` : undefined}
        confirmLabel="Delete document"
        danger
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
