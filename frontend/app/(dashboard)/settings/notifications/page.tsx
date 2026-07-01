'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import {
  CrudToolbar,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  type DataTableColumn,
} from '../../../../components/ui';
import { useClientPagination } from '../../../../hooks/use-client-pagination';
import { getSession, hasPermission } from '../../../../lib/auth';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreference,
} from '../../../../lib/notifications';

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const session = getSession();
  const canRead = hasPermission(session, 'notifications.read');
  const canUpdate = hasPermission(session, 'notifications.preferences.update');

  const load = useCallback(async () => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    try {
      const data = await fetchNotificationPreferences();
      setPrefs(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(eventKey: string, field: 'in_app' | 'email') {
    if (!canUpdate) return;
    setPrefs((prev) =>
      prev.map((p) =>
        p.event_key === eventKey ? { ...p, [field]: !p[field] } : p,
      ),
    );
  }

  async function save() {
    if (!canUpdate) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await updateNotificationPreferences(
        prefs.map((p) => ({
          event_key: p.event_key,
          in_app: p.in_app,
          email: p.email,
        })),
      );
      setPrefs(updated);
      setMessage('Preferences saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const filteredPrefs = prefs.filter((pref) =>
    [pref.label, pref.type, pref.event_key].join(' ').toLowerCase().includes(search.trim().toLowerCase()),
  );
  const pager = useClientPagination(filteredPrefs, 50);

  if (!canRead) {
    return <p className="text-slate-600">You do not have permission to manage notification settings.</p>;
  }

  const columns: DataTableColumn<NotificationPreference>[] = [
    {
      key: 'event',
      header: 'Event',
      render: (pref) => (
        <div>
          <p className="font-semibold text-slate-900">{pref.label}</p>
          <p className="text-2xs text-slate-400">{pref.type}</p>
        </div>
      ),
    },
    {
      key: 'in_app',
      header: 'In-app',
      align: 'center',
      render: (pref) => (
        <input
          type="checkbox"
          checked={pref.in_app}
          disabled={!canUpdate}
          onChange={() => toggle(pref.event_key, 'in_app')}
          className="h-4 w-4 rounded border-slate-300 text-teal-700"
          aria-label={`${pref.label} in-app notifications`}
        />
      ),
    },
    {
      key: 'email',
      header: 'Email',
      align: 'center',
      render: (pref) => (
        <input
          type="checkbox"
          checked={pref.email}
          disabled={!canUpdate}
          onChange={() => toggle(pref.event_key, 'email')}
          className="h-4 w-4 rounded border-slate-300 text-teal-700"
          aria-label={`${pref.label} email notifications`}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Link href="/notifications" className="text-sm text-teal-700 hover:underline">
        ← Notifications
      </Link>
      <PageHeader
        title="Notification settings"
        description="Choose how you want to be notified for each event. In-app notifications appear in the bell menu; email uses your account email address."
      />

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
          {message}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-reos-border bg-white shadow-card">
        <CrudToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search notification events"
          onRefresh={load}
          refreshing={loading}
          addSlot={
            <button type="button" disabled={saving || loading || !canUpdate} onClick={() => void save()} className="btn-primary">
              {saving ? 'Saving…' : canUpdate ? 'Save preferences' : 'Preference changes require permission'}
            </button>
          }
        />
        <DataTable<NotificationPreference>
          columns={columns}
          rows={pager.pageRows}
          rowKey={(pref) => pref.event_key}
          loading={loading}
          empty={<EmptyState title="No notification preferences found" description="Try a different search term." />}
        />

        {!loading && filteredPrefs.length > 0 ? (
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
    </div>
  );
}
