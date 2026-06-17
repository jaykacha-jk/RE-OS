'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';

import {
  ActionMenu,
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
  fetchAiCalls,
  initiateAiCall,
  isRealVoiceProviderAvailable,
  temperatureColor,
  type AiCallSummary,
} from '../../../../lib/ai';
import { getSession, hasPermission } from '../../../../lib/auth';

export default function AiCallsPage() {
  return (
    <Suspense fallback={null}>
      <AiCallsInner />
    </Suspense>
  );
}

const FILTER_KEYS = ['status', 'direction'];

function AiCallsInner() {
  const query = useTableQuery({ filterKeys: FILTER_KEYS });
  const [calls, setCalls] = useState<AiCallSummary[]>([]);
  const [meta, setMeta] = useState<{ page: number; total_pages: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<TableQueryValues>(query.filters);
  const voiceAvailable = isRealVoiceProviderAvailable();
  const { filters, page, setPage, perPage, setPerPage, search } = query;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAiCalls({
        page,
        per_page: perPage,
        search: search || undefined,
        status: filters.status || undefined,
        direction: filters.direction || undefined,
      });
      setCalls(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calls');
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search, filters.status, filters.direction]);

  useEffect(() => {
    setCanCreate(hasPermission(getSession(), 'ai.calls.create'));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function placeCall() {
    setBusy(true);
    setError(null);
    try {
      await initiateAiCall({ client_phone: phone, client_name: name || undefined, consent_recorded: true });
      setPhone('');
      setName('');
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place call');
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<AiCallSummary>[] = [
    {
      key: 'client',
      header: 'Client',
      render: (call) => (
        <div>
          <p className="font-semibold text-slate-900">{call.client_name ?? call.client_phone}</p>
          <p className="font-mono text-2xs text-slate-500">{call.client_phone}</p>
        </div>
      ),
    },
    { key: 'direction', header: 'Direction', render: (call) => <span className="capitalize text-slate-700">{call.direction}</span> },
    { key: 'status', header: 'Status', render: (call) => <span className="badge badge-slate capitalize">{call.status}</span> },
    { key: 'score', header: 'Score', align: 'right', cellClassName: 'tabular-nums text-slate-700', render: (call) => call.qualification_score ?? '—' },
    {
      key: 'temperature',
      header: 'Temp',
      render: (call) => (
        <span className={`rounded px-2 py-0.5 text-2xs capitalize ${temperatureColor(call.temperature)}`}>
          {call.temperature ?? '—'}
        </span>
      ),
    },
    { key: 'sentiment', header: 'Sentiment', render: (call) => <span className="capitalize text-slate-700">{call.sentiment ?? '—'}</span> },
    { key: 'when', header: 'When', cellClassName: 'text-slate-500', render: (call) => new Date(call.created_at).toLocaleString('en-IN') },
  ];

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

      <section className="overflow-hidden rounded-2xl border border-reos-border bg-white shadow-card">
        <CrudToolbar
          searchValue={query.searchInput}
          onSearchChange={query.setSearchInput}
          searchPlaceholder="Search client or phone"
          onFilter={() => {
            setDraft(filters);
            setFilterOpen(true);
          }}
          filterCount={query.activeFilterCount}
          onRefresh={load}
          refreshing={loading}
          addSlot={
            canCreate && voiceAvailable ? (
              <button type="button" className="btn-primary" onClick={() => setFormOpen(true)}>
                <Icon name="plus" className="h-4 w-4" /> Initiate voice call
              </button>
            ) : null
          }
        />

        <DataTable<AiCallSummary>
          columns={columns}
          rows={calls}
          rowKey={(call) => call.id}
          loading={loading}
          empty={
            <EmptyState
              title="No call logs found"
              description={voiceAvailable ? 'Initiate a voice call or clear filters.' : 'Real outbound calling is not enabled yet.'}
            />
          }
          actions={(call) => <ActionMenu items={[{ label: 'View', href: `/ai/calls/${call.id}` }]} />}
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
        onApply={() => query.applyFilters(draft)}
        onClear={() => {
          query.clearFilters();
          setDraft(Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])));
        }}
      >
        <FilterField label="Status">
          <input value={draft.status ?? ''} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))} className="input" placeholder="completed, failed" />
        </FilterField>
        <FilterField label="Direction">
          <select value={draft.direction ?? ''} onChange={(e) => setDraft((d) => ({ ...d, direction: e.target.value }))} className="input">
            <option value="">All directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
        </FilterField>
      </FilterDrawer>

      <FormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Initiate voice call"
        description="Recording consent is disclosed in-call (BR-AI06)."
        onSubmit={placeCall}
        submitting={busy}
        error={null}
        submitLabel="Initiate call"
      >
        <FormSection title="Client details" description="Use the Indian phone format when placing outbound calls.">
          <FormField label="Client phone" required full>
            <input className="input" value={phone} required placeholder="+9198XXXXXXXX" onChange={(e) => setPhone(e.target.value)} />
          </FormField>
          <FormField label="Client name" full>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
        </FormSection>
      </FormDrawer>
    </div>
  );
}
