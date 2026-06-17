'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  ActionMenu,
  CrudToolbar,
  DataTable,
  EmptyState,
  FormDrawer,
  FormField,
  FormSection,
  Icon,
  PageHeader,
  Pagination,
  type DataTableColumn,
} from '../../../components/ui';
import { useClientPagination } from '../../../hooks/use-client-pagination';
import { apiFetch } from '../../../lib/api';
import { getSession, hasPermission } from '../../../lib/auth';
import type { LeadSource } from '../../../lib/crm';

export default function LeadSourcesPage() {
  const [rows, setRows] = useState<LeadSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCanManage(hasPermission(getSession(), 'crm.lead_sources.manage'));
  }, []);

  const load = useCallback(() => {
    const session = getSession();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    apiFetch<LeadSource[]>('/api/v1/lead-sources?include_inactive=true', {
      token: session.access_token,
    })
      .then((res) => setRows(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load lead sources'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    const session = getSession();
    if (!session?.access_token || !name.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch('/api/v1/lead-sources', {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({ name: name.trim(), code: code.trim() || undefined }),
      });
      setName('');
      setCode('');
      setDrawerOpen(false);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create lead source');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(source: LeadSource) {
    const session = getSession();
    if (!session?.access_token) return;
    try {
      await apiFetch(`/api/v1/lead-sources/${source.id}`, {
        method: 'PATCH',
        token: session.access_token,
        body: JSON.stringify({ is_active: !source.is_active }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lead source');
    }
  }

  const filteredRows = rows.filter((row) => {
    const haystack = [row.name, row.code, row.is_system ? 'system' : 'custom', row.is_active ? 'active' : 'inactive']
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  const pager = useClientPagination(filteredRows);

  const columns: DataTableColumn<LeadSource>[] = [
    { key: 'name', header: 'Name', render: (row) => <span className="font-semibold text-slate-900">{row.name}</span> },
    { key: 'code', header: 'Code', render: (row) => <span className="font-mono text-2xs text-slate-500">{row.code ?? '—'}</span> },
    { key: 'type', header: 'Type', render: (row) => <span className="text-slate-700">{row.is_system ? 'System' : 'Custom'}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={`badge ${row.is_active ? 'badge-green' : 'badge-slate'}`}>
          {row.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM setup"
        title="Lead sources"
        description="Manage where your leads come from. Sources power inquiry attribution and reporting."
      />

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <section className="overflow-hidden rounded-2xl border border-reos-border bg-white shadow-card">
        <CrudToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search lead sources"
          onRefresh={load}
          refreshing={loading}
          addSlot={
            canManage ? (
              <button type="button" className="btn-primary" onClick={() => setDrawerOpen(true)}>
                <Icon name="plus" className="h-4 w-4" /> Add source
              </button>
            ) : null
          }
        />

        <DataTable<LeadSource>
          columns={columns}
          rows={pager.pageRows}
          rowKey={(row) => row.id}
          loading={loading}
          empty={
            <EmptyState
              title="No lead sources found"
              description="Add channels like Google Ads, WhatsApp, Referral, and Walk-in to make reporting useful."
              action={
                canManage ? (
                  <button type="button" className="btn-primary" onClick={() => setDrawerOpen(true)}>
                    Add source
                  </button>
                ) : null
              }
            />
          }
          actions={
            canManage
              ? (row) => (
                  <ActionMenu
                    items={[
                      {
                        label: row.is_active ? 'Deactivate' : 'Activate',
                        onSelect: () => toggleActive(row),
                      },
                    ]}
                  />
                )
              : undefined
          }
        />

        {!loading && filteredRows.length > 0 ? (
          <Pagination
            page={pager.page}
            totalPages={pager.totalPages}
            total={pager.total}
            perPage={pager.perPage}
            onPageChange={pager.setPage}
            onPerPageChange={pager.setPerPage}
          />
        ) : null}
      </section>

      <FormDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setFormError(null);
        }}
        title="Add lead source"
        description="Small setup forms open in a drawer so users keep their place in the list."
        onSubmit={create}
        submitting={saving}
        error={formError}
        submitLabel="Add source"
      >
        <FormSection title="Source details" description="The code is optional and can map imported or marketing-channel values.">
          <FormField label="Name" required full>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="input" placeholder="e.g. Google Ads" />
          </FormField>
          <FormField label="Code" full>
            <input value={code} onChange={(e) => setCode(e.target.value)} className="input" placeholder="optional" />
          </FormField>
        </FormSection>
      </FormDrawer>
    </div>
  );
}
