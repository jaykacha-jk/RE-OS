'use client';

import { useCallback, useEffect, useState } from 'react';

import { ActionGuard } from '../../../components/shared/ActionGuard';
import {
  ActionMenu,
  ConfirmDialog,
  CrudToolbar,
  DataTable,
  EmptyState,
  Icon,
  PageHeader,
  Pagination,
  type DataTableColumn,
} from '../../../components/ui';
import { useClientPagination } from '../../../hooks/use-client-pagination';
import { apiFetch } from '../../../lib/api';
import { getSession, hasPermission } from '../../../lib/auth';
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

export default function EmployeesPage() {
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [canUpdate, setCanUpdate] = useState(false);

  useEffect(() => {
    const session = getSession();
    setCanDelete(hasPermission(session, 'employees.delete'));
    setCanUpdate(hasPermission(session, 'employees.update'));
  }, []);

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

  const load = useCallback(() => {
    const session = getSession();
    if (!session?.access_token) return;

    setLoading(true);
    apiFetch<EmployeeRow[]>('/api/v1/employees', { token: session.access_token })
      .then((res) => setRows(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = rows.filter((row) => {
    const haystack = [row.first_name, row.last_name, row.email, row.role_code, row.status].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  const pager = useClientPagination(filteredRows);

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

      <section className="overflow-hidden rounded-2xl border border-reos-border bg-white shadow-card">
        <CrudToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search employees"
          onRefresh={load}
          refreshing={loading}
          addSlot={
            <ActionGuard permission="employees.create">
              <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
                <Icon name="plus" className="h-4 w-4" /> Add employee
              </button>
            </ActionGuard>
          }
        />

        <DataTable<EmployeeRow>
          columns={columns}
          rows={pager.pageRows}
          rowKey={(row) => row.id}
          loading={loading}
          empty={
            <EmptyState
              title="No employees found"
              description="Invite your team so inquiries, properties, and follow-ups have clear ownership."
              action={
                <ActionGuard permission="employees.create">
                  <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
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

      <CreateEmployeeForm open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />

      <EditEmployeeForm
        employee={editTarget}
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        onSaved={load}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove employee?"
        description={deleteTarget ? `${deleteTarget.email} will lose access to this tenant workspace.` : undefined}
        confirmLabel="Remove employee"
        danger
        loading={deleting}
        onConfirm={removeEmployee}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
