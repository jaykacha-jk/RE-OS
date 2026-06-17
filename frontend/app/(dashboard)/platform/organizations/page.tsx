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
} from '../../../../components/ui';
import { useClientPagination } from '../../../../hooks/use-client-pagination';
import { apiFetch } from '../../../../lib/api';
import { getSession } from '../../../../lib/auth';

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  tier: string;
  employees_count: number;
};

const STATUSES = ['trial', 'active', 'suspended', 'cancelled'] as const;
const TIERS = ['basic', 'pro', 'enterprise'] as const;

export default function OrganizationsPage() {
  const [rows, setRows] = useState<OrganizationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationRow | null>(null);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    status: 'trial',
    tier: 'basic',
    billing_email: '',
    owner_email: '',
  });

  const load = useCallback(() => {
    const session = getSession();
    if (!session?.access_token) return;

    setLoading(true);
    apiFetch<OrganizationRow[]>('/api/v1/platform/organizations', {
      token: session.access_token,
    })
      .then((res) => setRows(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setForm({
      name: '',
      slug: '',
      status: 'trial',
      tier: 'basic',
      billing_email: '',
      owner_email: '',
    });
    setFormError(null);
    setCreateOpen(true);
  }

  function openEdit(row: OrganizationRow) {
    setForm({
      name: row.name,
      slug: row.slug,
      status: row.status,
      tier: row.tier,
      billing_email: '',
      owner_email: '',
    });
    setFormError(null);
    setEditing(row);
  }

  async function createOrganization() {
    const session = getSession();
    if (!session?.access_token) return;

    setSaving(true);
    setFormError(null);
    try {
      await apiFetch('/api/v1/platform/organizations', {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          tier: form.tier,
          billing_email: form.billing_email,
          owner_email: form.owner_email,
        }),
      });
      setCreateOpen(false);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function updateOrganization() {
    const session = getSession();
    if (!session?.access_token || !editing) return;

    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(`/api/v1/platform/organizations/${editing.id}`, {
        method: 'PATCH',
        token: session.access_token,
        body: JSON.stringify({ name: form.name, status: form.status, tier: form.tier }),
      });
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  const filteredRows = rows.filter((row) => {
    const haystack = [row.name, row.slug, row.status, row.tier].join(' ').toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  const pager = useClientPagination(filteredRows);

  const columns: DataTableColumn<OrganizationRow>[] = [
    { key: 'name', header: 'Name', render: (row) => <span className="font-semibold text-slate-900">{row.name}</span> },
    { key: 'slug', header: 'Slug', render: (row) => <span className="font-mono text-2xs text-slate-500">{row.slug}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <span className={`badge ${row.status === 'active' ? 'badge-green' : row.status === 'suspended' ? 'badge-rose' : 'badge-slate'}`}>{row.status}</span>,
    },
    { key: 'tier', header: 'Plan', render: (row) => <span className="capitalize text-slate-700">{row.tier}</span> },
    { key: 'employees', header: 'Employees', align: 'right', cellClassName: 'tabular-nums text-slate-700', render: (row) => row.employees_count.toLocaleString('en-IN') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="Organizations" description="Super Admin platform view for tenant organizations." />

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-reos-border bg-white shadow-card">
        <CrudToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search organizations"
          onRefresh={load}
          refreshing={loading}
          addSlot={
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Icon name="plus" className="h-4 w-4" /> Create organization
            </button>
          }
        />

        <DataTable<OrganizationRow>
          columns={columns}
          rows={pager.pageRows}
          rowKey={(row) => row.id}
          loading={loading}
          empty={<EmptyState title="No organizations found" description="Create the first tenant workspace to start platform operations." />}
          actions={(row) => (
            <ActionMenu
              items={[
                {
                  label: 'Edit',
                  onSelect: () => openEdit(row),
                },
              ]}
            />
          )}
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
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create organization"
        description="Provision a new tenant workspace and initial owner."
        onSubmit={createOrganization}
        submitting={saving}
        error={formError}
        submitLabel="Create organization"
      >
        <OrganizationFormFields form={form} setForm={setForm} mode="create" />
      </FormDrawer>

      <FormDrawer
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit organization"
        description={editing ? `Update ${editing.slug} platform settings.` : undefined}
        onSubmit={updateOrganization}
        submitting={saving}
        error={formError}
        submitLabel="Save changes"
      >
        <OrganizationFormFields form={form} setForm={setForm} mode="edit" />
      </FormDrawer>
    </div>
  );
}

function OrganizationFormFields({
  form,
  setForm,
  mode,
}: {
  form: {
    name: string;
    slug: string;
    status: string;
    tier: string;
    billing_email: string;
    owner_email: string;
  };
  setForm: (next: {
    name: string;
    slug: string;
    status: string;
    tier: string;
    billing_email: string;
    owner_email: string;
  }) => void;
  mode: 'create' | 'edit';
}) {
  return (
    <FormSection title="Organization details" description={mode === 'create' ? 'Owner and billing emails are required for initial provisioning.' : 'Slug and owner fields are locked after provisioning.'}>
      <FormField label="Name" required full>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="input" />
      </FormField>
      <FormField label="Slug" required>
        <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required disabled={mode === 'edit'} className="input disabled:bg-slate-50 disabled:text-slate-500" />
      </FormField>
      <FormField label="Tier" required>
        <select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} required className="input">
          {TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {tier}
            </option>
          ))}
        </select>
      </FormField>
      {mode === 'edit' ? (
        <FormField label="Status" required full>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} required className="input">
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </FormField>
      ) : (
        <>
          <FormField label="Billing email" required full>
            <input value={form.billing_email} onChange={(e) => setForm({ ...form, billing_email: e.target.value })} type="email" required className="input" />
          </FormField>
          <FormField label="Owner email" required full>
            <input value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} type="email" required className="input" />
          </FormField>
        </>
      )}
    </FormSection>
  );
}
