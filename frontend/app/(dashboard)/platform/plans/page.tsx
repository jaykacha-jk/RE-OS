'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  ActionMenu,
  ConfirmDialog,
  CrudToolbar,
  DataTable,
  Drawer,
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
import {
  createPlatformPlan,
  defaultPlanFeaturesJson,
  fetchPlatformPlans,
  paiseToRupees,
  rupeesToPaise,
  updatePlatformPlan,
  type PlatformPlan,
} from '../../../../lib/platform-plans';
import { formatLimit, formatMoney, formatStorage } from '../../../../lib/billing';

type PlanForm = {
  code: string;
  name: string;
  monthly_inr: string;
  yearly_inr: string;
  max_properties: string;
  max_employees: string;
  storage_gb: string;
  max_ai_minutes: string;
  features_json: string;
  is_active: boolean;
};

const EMPTY_FORM: PlanForm = {
  code: '',
  name: '',
  monthly_inr: '',
  yearly_inr: '',
  max_properties: '100',
  max_employees: '5',
  storage_gb: '5',
  max_ai_minutes: '0',
  features_json: defaultPlanFeaturesJson(),
  is_active: true,
};

function gbToBytes(gb: string): number {
  const value = Number(gb);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 1024 * 1024 * 1024);
}

function bytesToGb(bytes: number): string {
  if (!bytes) return '0';
  return String(Math.round((bytes / 1024 / 1024 / 1024) * 10) / 10);
}

function planToForm(plan: PlatformPlan): PlanForm {
  return {
    code: plan.code,
    name: plan.name,
    monthly_inr: paiseToRupees(plan.monthly_price),
    yearly_inr: paiseToRupees(plan.yearly_price),
    max_properties: String(plan.property_limit),
    max_employees: String(plan.employee_limit),
    storage_gb: bytesToGb(plan.storage_limit),
    max_ai_minutes: String(plan.ai_minutes_limit ?? 0),
    features_json: JSON.stringify(plan.features ?? {}, null, 2),
    is_active: plan.is_active,
  };
}

function formToPayload(form: PlanForm, mode: 'create' | 'edit') {
  let features: Record<string, unknown> = {};
  try {
    features = JSON.parse(form.features_json) as Record<string, unknown>;
  } catch {
    throw new Error('Features must be valid JSON');
  }

  const base = {
    name: form.name.trim(),
    price_inr_monthly: rupeesToPaise(form.monthly_inr),
    price_inr_yearly: form.yearly_inr.trim() ? rupeesToPaise(form.yearly_inr) : null,
    max_properties: Number(form.max_properties),
    max_employees: Number(form.max_employees),
    storage_limit_bytes: gbToBytes(form.storage_gb),
    max_ai_minutes_monthly: Number(form.max_ai_minutes),
    features,
    is_active: form.is_active,
  };

  if (mode === 'create') {
    return { ...base, code: form.code.trim().toLowerCase() };
  }
  return base;
}

export default function PlatformPlansPage() {
  const [rows, setRows] = useState<PlatformPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformPlan | null>(null);
  const [viewing, setViewing] = useState<PlatformPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlatformPlan | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchPlatformPlans()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load plans'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setCreateOpen(true);
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function openEdit(row: PlatformPlan) {
    setEditing(row);
    setForm(planToForm(row));
    setFormError(null);
    setCreateOpen(false);
    setViewing(null);
  }

  async function deactivatePlan() {
    if (!deleteTarget) return;

    setDeleting(true);
    setError(null);
    try {
      await updatePlatformPlan(deleteTarget.id, { is_active: false });
      setDeleteTarget(null);
      if (editing?.id === deleteTarget.id) setEditing(null);
      if (viewing?.id === deleteTarget.id) setViewing(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deactivate failed');
    } finally {
      setDeleting(false);
    }
  }

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      const payload = formToPayload(form, editing ? 'edit' : 'create');
      if (editing) {
        await updatePlatformPlan(editing.id, payload);
      } else {
        await createPlatformPlan(payload);
      }
      setCreateOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const filteredRows = rows.filter((row) => {
    const haystack = [row.code, row.name, row.is_active ? 'active' : 'inactive']
      .join(' ')
      .toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  const pager = useClientPagination(filteredRows);

  const columns: DataTableColumn<PlatformPlan>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => <span className="font-mono text-2xs text-slate-500">{row.code}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="font-semibold text-slate-900">{row.name}</span>,
    },
    {
      key: 'monthly',
      header: 'Monthly',
      align: 'right',
      cellClassName: 'tabular-nums text-slate-700',
      render: (row) => formatMoney(row.monthly_price),
    },
    {
      key: 'limits',
      header: 'Limits',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {formatLimit(row.property_limit)} props · {formatLimit(row.employee_limit)} users ·{' '}
          {formatStorage(row.storage_limit)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={`badge ${row.is_active ? 'badge-green' : 'badge-slate'}`}>
          {row.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'subs',
      header: 'Subscriptions',
      align: 'right',
      cellClassName: 'tabular-nums text-slate-700',
      render: (row) => (row.active_subscriptions ?? 0).toLocaleString('en-IN'),
    },
  ];

  const drawerOpen = createOpen || !!editing;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Subscription plans"
        description="Manage the global plan catalog tenants see on Billing → Plans."
      />

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-reos-border bg-white shadow-card">
        <CrudToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search plans"
          onRefresh={load}
          refreshing={loading}
          addSlot={
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Icon name="plus" className="h-4 w-4" /> New plan
            </button>
          }
        />

        <DataTable<PlatformPlan>
          columns={columns}
          rows={pager.pageRows}
          rowKey={(row) => row.id}
          loading={loading}
          empty={
            <EmptyState
              title="No plans found"
              description="Create the first subscription plan for the platform."
              action={
                <button type="button" className="btn-primary" onClick={openCreate}>
                  New plan
                </button>
              }
            />
          }
          actions={(row) => (
            <ActionMenu
              items={[
                {
                  label: 'View',
                  onSelect: () => setViewing(row),
                },
                {
                  label: 'Edit',
                  onSelect: () => openEdit(row),
                },
                {
                  label: 'Delete',
                  danger: true,
                  hidden: !row.is_active,
                  disabled: (row.active_subscriptions ?? 0) > 0,
                  onSelect: () => setDeleteTarget(row),
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

      <Drawer
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.name ?? 'Plan details'}
        description={viewing ? `Code: ${viewing.code}` : undefined}
        width="lg"
        footer={
          viewing ? (
            <>
              <button type="button" className="btn-secondary" onClick={() => setViewing(null)}>
                Close
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  openEdit(viewing);
                }}
              >
                Edit plan
              </button>
            </>
          ) : null
        }
      >
        {viewing ? <PlanDetails plan={viewing} /> : null}
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Deactivate plan?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be hidden from the tenant plan picker. Plans with active subscriptions cannot be deactivated.`
            : undefined
        }
        confirmLabel={deleting ? 'Deactivating…' : 'Deactivate plan'}
        danger
        loading={deleting}
        onConfirm={() => void deactivatePlan()}
        onCancel={() => setDeleteTarget(null)}
      />

      <FormDrawer
        open={drawerOpen}
        onClose={() => {
          setCreateOpen(false);
          setEditing(null);
          setFormError(null);
        }}
        title={editing ? 'Edit plan' : 'Create plan'}
        description="Prices are in INR. Storage uses GB (0 = unlimited)."
        submitting={saving}
        onSubmit={() => void save()}
        submitLabel={editing ? 'Save changes' : 'Create plan'}
        error={formError}
      >
        <FormSection title="Identity" compact>
          <FormField label="Code" required hint="Lowercase slug — cannot be changed after create.">
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })}
              disabled={!!editing}
              required
              className="input font-mono"
              placeholder="growth"
            />
          </FormField>
          <FormField label="Name" required>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="input"
              placeholder="Growth"
            />
          </FormField>
          <FormField label="Active">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Visible to tenants on the plan picker
            </label>
          </FormField>
        </FormSection>

        <FormSection title="Pricing (INR)" compact>
          <FormField label="Monthly price" required>
            <input
              value={form.monthly_inr}
              onChange={(e) => setForm({ ...form, monthly_inr: e.target.value })}
              type="number"
              min="0"
              step="1"
              required
              className="input"
              placeholder="4999"
            />
          </FormField>
          <FormField label="Yearly price" hint="Leave empty if not offered">
            <input
              value={form.yearly_inr}
              onChange={(e) => setForm({ ...form, yearly_inr: e.target.value })}
              type="number"
              min="0"
              step="1"
              className="input"
              placeholder="49990"
            />
          </FormField>
        </FormSection>

        <FormSection title="Quotas" compact>
          <FormField label="Max properties" required>
            <input
              value={form.max_properties}
              onChange={(e) => setForm({ ...form, max_properties: e.target.value })}
              type="number"
              min="1"
              required
              className="input"
            />
          </FormField>
          <FormField label="Max employees" required>
            <input
              value={form.max_employees}
              onChange={(e) => setForm({ ...form, max_employees: e.target.value })}
              type="number"
              min="1"
              required
              className="input"
            />
          </FormField>
          <FormField label="Storage (GB)" hint="0 = unlimited">
            <input
              value={form.storage_gb}
              onChange={(e) => setForm({ ...form, storage_gb: e.target.value })}
              type="number"
              min="0"
              step="0.1"
              className="input"
            />
          </FormField>
          <FormField label="AI minutes / month">
            <input
              value={form.max_ai_minutes}
              onChange={(e) => setForm({ ...form, max_ai_minutes: e.target.value })}
              type="number"
              min="0"
              className="input"
            />
          </FormField>
        </FormSection>

        <FormSection title="Feature flags (JSON)" compact>
          <FormField label="Features" full>
            <textarea
              value={form.features_json}
              onChange={(e) => setForm({ ...form, features_json: e.target.value })}
              rows={6}
              className="input font-mono text-xs"
            />
          </FormField>
        </FormSection>
      </FormDrawer>
    </div>
  );
}

function PlanDetails({ plan }: { plan: PlatformPlan }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Status</p>
          <p className="mt-1">
            <span className={`badge ${plan.is_active ? 'badge-green' : 'badge-slate'}`}>
              {plan.is_active ? 'Active' : 'Inactive'}
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Active subscriptions</p>
          <p className="mt-1 font-semibold tabular-nums text-slate-900">
            {(plan.active_subscriptions ?? 0).toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Monthly price</p>
          <p className="mt-1 font-semibold tabular-nums text-slate-900">{formatMoney(plan.monthly_price)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Yearly price</p>
          <p className="mt-1 font-semibold tabular-nums text-slate-900">
            {plan.yearly_price != null ? formatMoney(plan.yearly_price) : 'Not offered'}
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Quotas</p>
        <p className="mt-1 text-slate-700">
          {formatLimit(plan.property_limit)} properties · {formatLimit(plan.employee_limit)} employees ·{' '}
          {formatStorage(plan.storage_limit)} · {plan.ai_minutes_limit ?? 0} AI min/mo
        </p>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Features</p>
        <div className="mt-2">
          <pre className="overflow-x-auto rounded-xl border border-reos-border bg-slate-50 p-3 font-mono text-xs text-slate-700">
            {JSON.stringify(plan.features ?? {}, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
