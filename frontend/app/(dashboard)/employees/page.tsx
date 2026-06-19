'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';

import { ActionGuard } from '../../../components/shared/ActionGuard';
import { QuotaNotice, proactiveQuotaNoticeProps } from '../../../components/billing/quota-notice';
import {
  ActionMenu,
  ConfirmDialog,
  CrudToolbar,
  DataTable,
  EmptyState,
  FilterDrawer,
  FilterField,
  Icon,
  PageHeader,
  Pagination,
  type DataTableColumn,
} from '../../../components/ui';
import { useTableQuery, type TableQueryValues } from '../../../hooks/use-table-query';
import { useBillingUsage } from '../../../hooks/use-billing-usage';
import { apiFetch } from '../../../lib/api';
import { getSession, hasPermission } from '../../../lib/auth';
import { proactiveQuotaMessage } from '../../../lib/quota';
import { CreateEmployeeForm } from './create-employee-form';
import { EditEmployeeForm } from './edit-employee-form';

type EmployeeRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role_code: string | null;
  status: string;
};

type ListMeta = {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
};

const FILTER_KEYS = ['role', 'status'];
const ROLES = ['org_admin', 'sales_manager', 'sales_executive', 'telecaller'] as const;
const STATUSES = ['active', 'inactive'] as const;

export default function EmployeesPage() {
  return (
    <Suspense fallback={null}>
      <EmployeesInner />
    </Suspense>
  );
}

function EmployeesInner() {
  const query = useTableQuery({
    filterKeys: FILTER_KEYS,
    searchKey: 'filter[search]',
    defaultPerPage: 20,
  });

  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<TableQueryValues>(query.filters);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [canUpdate, setCanUpdate] = useState(false);
  const { usage, employeeAtLimit } = useBillingUsage();

  const { searchInput, setSearchInput, search, filters, activeFilterCount, applyFilters, clearFilters, page, setPage, perPage, setPerPage } = query;
  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    const session = getSession();
    setCanDelete(hasPermission(session, 'employees.delete'));
    setCanUpdate(hasPermission(session, 'employees.update'));
  }, []);

  const load = useCallback(() => {
    const session = getSession();
    if (!session?.access_token) return;

    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (search.trim()) params.set('filter[search]', search.trim());
    const f = JSON.parse(filtersKey) as TableQueryValues;
    if (f.role) params.set('filter[role]', f.role);
    if (f.status) params.set('filter[status]', f.status);

    setLoading(true);
    setError(null);
    apiFetch<EmployeeRow[]>(`/api/v1/employees?${params.toString()}`, { token: session.access_token })
      .then((res) => {
        setRows(res.data);
        setMeta(res.meta as unknown as ListMeta);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [page, perPage, search, filtersKey]);

  useEffect(() => {
    load();
  }, [load]);

  async function removeEmployee() {
    const session = getSession();
    if (!session?.access_token || !deleteTarget) return;

    setDeleting(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/employees/${deleteTarget.id}`, {
        method: 'DELETE',
        token: session.access_token,
      });
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  const columns: DataTableColumn<EmployeeRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="font-semibold text-slate-900">{[row.first_name, row.last_name].filter(Boolean).join(' ') || '—'}</span>,
    },
    { key: 'email', header: 'Email', render: (row) => <span className="text-slate-700">{row.email}</span> },
    {
      key: 'role',
      header: 'Role',
      render: (row) => <span className="text-slate-700">{row.role_code?.replace(/_/g, ' ') ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={`badge ${row.status === 'active' ? 'badge-green' : 'badge-slate'}`}>
          {row.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Team"
        title="Employees"
        description="Manage tenant-scoped team members, roles, invitations, and access."
      />

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      {usage && employeeAtLimit ? (
        <QuotaNotice
          {...proactiveQuotaNoticeProps(
            'employees',
            usage.plan.name,
            `${proactiveQuotaMessage('employees', usage)} Upgrade to invite more team members.`,
          )}
        />
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-reos-border bg-white shadow-card">
        <CrudToolbar
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Search employees"
          onRefresh={load}
          refreshing={loading}
          filterCount={activeFilterCount}
          onFilter={() => {
            setDraft(filters);
            setFilterOpen(true);
          }}
          addSlot={
            <ActionGuard permission="employees.create">
              <button
                type="button"
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setCreateOpen(true)}
                disabled={employeeAtLimit}
                title={employeeAtLimit ? 'Employee limit reached for your current plan' : undefined}
              >
                <Icon name="plus" className="h-4 w-4" /> Add employee
              </button>
            </ActionGuard>
          }
        />

        <DataTable<EmployeeRow>
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={loading}
          empty={
            <EmptyState
              title="No employees found"
              description="Invite your team so inquiries, properties, and follow-ups have clear ownership."
              action={
                <ActionGuard permission="employees.create">
                  <button
                    type="button"
                    className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => setCreateOpen(true)}
                    disabled={employeeAtLimit}
                  >
                    Add employee
                  </button>
                </ActionGuard>
              }
            />
          }
          actions={(row) => (
            <ActionMenu
              items={[
                {
                  label: 'Edit',
                  hidden: !canUpdate,
                  onSelect: () => setEditTarget(row),
                },
                {
                  label: 'Remove',
                  danger: true,
                  hidden: !canDelete,
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
        title="Filter employees"
        onApply={() => {
          applyFilters(draft);
          setFilterOpen(false);
        }}
        onClear={() => {
          clearFilters();
          setDraft({ role: '', status: '' });
          setFilterOpen(false);
        }}
      >
        <FilterField label="Role">
          <select value={draft.role ?? ''} onChange={(e) => setDraft({ ...draft, role: e.target.value })} className="input">
            <option value="">All roles</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </FilterField>
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
      </FilterDrawer>

      <CreateEmployeeForm open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />

      <EditEmployeeForm
        open={Boolean(editTarget)}
        employee={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={load}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove employee?"
        description={deleteTarget ? `${deleteTarget.email} will lose access to this organization.` : undefined}
        confirmLabel="Remove"
        danger
        loading={deleting}
        onConfirm={removeEmployee}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
