'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';

import {
  CrudToolbar,
  EmptyState,
  FilterDrawer,
  FilterField,
  PageHeader,
  Pagination,
} from '../../../components/ui';
import { NotificationItem } from '../../../components/notifications/notification-item';
import { useTableQuery, type TableQueryValues } from '../../../hooks/use-table-query';
import { getSession, hasPermission } from '../../../lib/auth';
import {
  fetchNotifications,
  groupNotifications,
  type ListMeta,
  type Notification,
} from '../../../lib/notifications';
import { useNotifications } from '../../../hooks/use-notifications';

export default function NotificationsPage() {
  return (
    <Suspense fallback={null}>
      <NotificationsInner />
    </Suspense>
  );
}

const FILTER_KEYS = ['read', 'type'];

function NotificationsInner() {
  const query = useTableQuery({ filterKeys: FILTER_KEYS });
  const { markRead, markAllRead, unreadCount } = useNotifications({ listLimit: 50 });
  const [rows, setRows] = useState<Notification[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<TableQueryValues>(query.filters);
  const [canRead, setCanRead] = useState(false);

  useEffect(() => {
    setCanRead(hasPermission(getSession(), 'notifications.read'));
  }, []);

  const { filters, page, setPage, perPage, setPerPage } = query;
  const readFilter = filters.read ?? '';
  const typeFilter = filters.type ?? '';

  const load = useCallback(
    async () => {
      if (!canRead) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetchNotifications({
          page,
          per_page: perPage,
          type: typeFilter || undefined,
          is_read:
            readFilter === '' ? undefined : readFilter === 'read',
        });
        setRows(res.data);
        setMeta(res.meta);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    },
    [canRead, page, perPage, readFilter, typeFilter],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (!canRead) {
    return (
      <p className="text-slate-600">You do not have permission to view notifications.</p>
    );
  }

  const visibleRows = rows.filter((row) => {
    const haystack = [row.title, row.message, row.type, row.priority].join(' ').toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });
  const groups = groupNotifications(visibleRows);
  const groupOrder = ['Today', 'Yesterday', 'Older'] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
      />

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-reos-border bg-white shadow-card">
        <CrudToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search notifications"
          onFilter={() => {
            setDraft(filters);
            setFilterOpen(true);
          }}
          filterCount={query.activeFilterCount}
          onRefresh={load}
          refreshing={loading}
          addSlot={
            unreadCount > 0 ? (
              <button type="button" onClick={() => void markAllRead().then(() => load())} className="btn-secondary">
                Mark all read
              </button>
            ) : null
          }
        />

        {loading ? (
          <div className="space-y-3 px-5 py-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : null}

        {!loading && visibleRows.length === 0 ? (
          <div className="px-5 py-10">
            <EmptyState title="No notifications match your filters" description="Try clearing filters or searching for a different type or message." />
          </div>
        ) : null}

        {!loading && visibleRows.length > 0 ? (
          <div className="px-5 py-5">
            {groupOrder.map((label) => {
              const groupItems = groups[label];
              if (!groupItems.length) return null;
              return (
                <section key={label} className="mb-6 last:mb-0">
                  <h2 className="mb-2 text-2xs font-bold uppercase tracking-wide text-slate-400">
                    {label}
                  </h2>
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                    {groupItems.map((n) => (
                      <div key={n.id} className="px-1">
                        <NotificationItem
                          notification={n}
                          onMarkRead={(id) => void markRead(id).then(() => load())}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : null}

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
        <FilterField label="Read status">
          <select value={draft.read ?? ''} onChange={(e) => setDraft((d) => ({ ...d, read: e.target.value }))} className="input">
            <option value="">All</option>
            <option value="unread">Unread only</option>
            <option value="read">Read only</option>
          </select>
        </FilterField>
        <FilterField label="Type">
          <select value={draft.type ?? ''} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))} className="input">
            <option value="">All types</option>
            <option value="CRM">CRM</option>
            <option value="PROPERTY">Property</option>
            <option value="SYSTEM">System</option>
            <option value="BILLING">Billing</option>
            <option value="CHAT">Chat</option>
            <option value="AI_AGENT">AI Agent</option>
          </select>
        </FilterField>
      </FilterDrawer>
    </div>
  );
}
