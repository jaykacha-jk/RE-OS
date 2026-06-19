'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
import { apiFetch } from '../../../../lib/api';
import { getSession } from '../../../../lib/auth';
import { startPlatformImpersonation } from '../../../../lib/platform-impersonation';
import { fetchPlatformPlans, type PlatformPlan } from '../../../../lib/platform-plans';

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  tier: string;
  billing_email: string;
  logo_url: string | null;
  employees_count: number;
};

type ListMeta = {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
};

const FILTER_KEYS = ['status', 'tier'];
const STATUSES = ['trial', 'active', 'suspended', 'cancelled'] as const;
const FALLBACK_TIERS = ['starter', 'pro', 'enterprise'] as const;

export default function OrganizationsPage() {
  return (
    <Suspense fallback={null}>
      <OrganizationsInner />
    </Suspense>
  );
}

function OrganizationsInner() {
  const router = useRouter();
  const query = useTableQuery({
    filterKeys: FILTER_KEYS,
    defaultPerPage: 20,
  });

  const [rows, setRows] = useState<OrganizationRow[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<TableQueryValues>(query.filters);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationRow | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [planOptions, setPlanOptions] = useState<PlatformPlan[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<OrganizationRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    status: 'trial',
    tier: 'starter',
    billing_email: '',
    owner_email: '',
  });

  const { filters, activeFilterCount, applyFilters, clearFilters, page, setPage, perPage, setPerPage } = query;
  const filtersKey = JSON.stringify(filters);

  const load = useCallback(() => {
    const session = getSession();
    if (!session?.access_token) return;

    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    const f = JSON.parse(filtersKey) as TableQueryValues;
    if (f.status) params.set('filter[status]', f.status);
    if (f.tier) params.set('filter[tier]', f.tier);

    setLoading(true);
    setError(null);
    apiFetch<OrganizationRow[]>(`/api/v1/platform/organizations?${params.toString()}`, {
      token: session.access_token,
    })
      .then((res) => {
        setRows(res.data);
        setMeta(res.meta as unknown as ListMeta);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [page, perPage, filtersKey]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchPlatformPlans()
      .then(setPlanOptions)
      .catch(() => setPlanOptions([]));
  }, []);

  const tierChoices =
    planOptions.length > 0
      ? planOptions.filter((p) => p.is_active).map((p) => ({ code: p.code, label: p.name }))
      : FALLBACK_TIERS.map((code) => ({ code, label: code }));

  function normalizeTier(tier: string) {
    return tier === 'basic' ? 'starter' : tier;
  }

  function openCreate() {
    setForm({
      name: '',
      slug: '',
      status: 'trial',
      tier: 'starter',
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
      tier: normalizeTier(row.tier),
      billing_email: row.billing_email,
      owner_email: '',
    });
    setLogoUrl(row.logo_url);
    setFormError(null);
    setEditing(row);
  }

  async function uploadLogo(file: File) {
    const session = getSession();
    if (!session?.access_token || !editing) return;
    if (!file.type.startsWith('image/')) {
      setFormError(`${file.name} is not an image`);
      return;
    }

    setUploadingLogo(true);
    setFormError(null);
    try {
      const contentBase64 = await readFileAsDataUrl(file);
      const res = await apiFetch<OrganizationRow>(`/api/v1/platform/organizations/${editing.id}/logo`, {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({
          content_base64: contentBase64,
          content_type: file.type,
          filename: file.name,
        }),
      });
      setLogoUrl(res.data.logo_url);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Logo upload failed');
    } finally {
      setUploadingLogo(false);
    }
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
        body: JSON.stringify({
          name: form.name,
          status: form.status,
          tier: form.tier,
          billing_email: form.billing_email,
        }),
      });
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrganization() {
    const session = getSession();
    if (!session?.access_token || !deleteTarget) return;

    setDeleting(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/platform/organizations/${deleteTarget.id}`, {
        method: 'DELETE',
        token: session.access_token,
      });
      setDeleteTarget(null);
      if (editing?.id === deleteTarget.id) setEditing(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  async function openWorkspace(row: OrganizationRow) {
    setImpersonatingId(row.id);
    setError(null);
    try {
      await startPlatformImpersonation(row.id);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open workspace');
    } finally {
      setImpersonatingId(null);
    }
  }

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
          searchValue=""
          onSearchChange={() => {}}
          searchPlaceholder="Filter by status or tier"
          onRefresh={load}
          refreshing={loading}
          filterCount={activeFilterCount}
          onFilter={() => {
            setDraft(filters);
            setFilterOpen(true);
          }}
          addSlot={
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Icon name="plus" className="h-4 w-4" /> Create organization
            </button>
          }
        />

        <DataTable<OrganizationRow>
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={loading}
          empty={<EmptyState title="No organizations found" description="Create the first tenant workspace to start platform operations." />}
          actions={(row) => (
            <ActionMenu
              items={[
                {
                  label: impersonatingId ? 'Opening…' : 'Open workspace',
                  onSelect: () => void openWorkspace(row),
                  disabled: impersonatingId === row.id,
                },
                {
                  label: 'Edit',
                  onSelect: () => openEdit(row),
                },
                {
                  label: 'Delete',
                  danger: true,
                  onSelect: () => setDeleteTarget(row),
                },
              ]}
            />
          )}
        />

        {!loading && meta && meta.total > 0 ? (
          <Pagination
            page={meta.page}
            totalPages={meta.total_pages}
            total={meta.total}
            perPage={meta.per_page}
            onPageChange={setPage}
            onPerPageChange={setPerPage}
          />
        ) : null}
      </section>

      <FilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter organizations"
        onApply={() => {
          applyFilters(draft);
          setFilterOpen(false);
        }}
        onClear={() => {
          clearFilters();
          setDraft({ status: '', tier: '' });
          setFilterOpen(false);
        }}
      >
        <FilterField label="Status">
          <select value={draft.status ?? ''} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="input">
            <option value="">All statuses</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Plan tier">
          <select value={draft.tier ?? ''} onChange={(e) => setDraft({ ...draft, tier: e.target.value })} className="input">
            <option value="">All tiers</option>
            {tierChoices.map((tier) => (
              <option key={tier.code} value={tier.code}>
                {tier.label}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterDrawer>

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
        <OrganizationFormFields form={form} setForm={setForm} mode="create" tierChoices={tierChoices} />
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
        <OrganizationFormFields
          form={form}
          setForm={setForm}
          mode="edit"
          logoUrl={logoUrl}
          uploadingLogo={uploadingLogo}
          onLogoSelect={(file) => void uploadLogo(file)}
          tierChoices={tierChoices}
        />
      </FormDrawer>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete organization?"
        description={
          deleteTarget
            ? `Soft-delete "${deleteTarget.name}" and mark it cancelled. This cannot be undone from the UI.`
            : undefined
        }
        confirmLabel={deleting ? 'Deleting…' : 'Delete organization'}
        danger
        loading={deleting}
        onConfirm={() => void deleteOrganization()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function OrganizationFormFields({
  form,
  setForm,
  mode,
  logoUrl,
  uploadingLogo,
  onLogoSelect,
  tierChoices,
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
  logoUrl?: string | null;
  uploadingLogo?: boolean;
  onLogoSelect?: (file: File) => void;
  tierChoices: Array<{ code: string; label: string }>;
}) {
  return (
    <FormSection title="Organization details" description={mode === 'create' ? 'Owner and billing emails are required for initial provisioning.' : 'Slug and owner fields are locked after provisioning.'}>
      <FormField label="Name" required full>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="input" />
      </FormField>
      <FormField label="Slug" required>
        <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required disabled={mode === 'edit'} className="input disabled:bg-slate-50 disabled:text-slate-500" />
      </FormField>
      <FormField label="Subscription plan" required hint="Syncs billing subscription and quota limits for this tenant.">
        <select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} required className="input">
          {tierChoices.map((tier) => (
            <option key={tier.code} value={tier.code}>
              {tier.label}
            </option>
          ))}
        </select>
      </FormField>
      {mode === 'edit' ? (
        <>
          <FormField label="Status" required full>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} required className="input">
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Billing email" required full>
            <input value={form.billing_email} onChange={(e) => setForm({ ...form, billing_email: e.target.value })} type="email" required className="input" />
          </FormField>
          <FormField label="Logo" full hint="PNG, JPEG, WebP, or GIF up to 10 MB.">
            <div className="flex flex-wrap items-center gap-4">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Organization logo" className="h-14 w-14 rounded-lg border border-reos-border object-contain bg-white" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-2xs text-slate-400">
                  No logo
                </div>
              )}
              <label className="btn-secondary cursor-pointer">
                {uploadingLogo ? 'Uploading…' : 'Upload logo'}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={uploadingLogo}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && onLogoSelect) onLogoSelect(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </FormField>
        </>
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
