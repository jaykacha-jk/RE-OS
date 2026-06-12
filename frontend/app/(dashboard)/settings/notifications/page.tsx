'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

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

  const canRead = hasPermission(getSession(), 'notifications.read');

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
    setPrefs((prev) =>
      prev.map((p) =>
        p.event_key === eventKey ? { ...p, [field]: !p[field] } : p,
      ),
    );
  }

  async function save() {
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

  if (!canRead) {
    return <p className="text-slate-600">You do not have permission to manage notification settings.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/notifications" className="text-sm text-teal-700 hover:underline">
        ← Notifications
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Notification settings</h1>
      <p className="mt-1 text-sm text-slate-500">
        Choose how you want to be notified for each event. In-app notifications appear in the bell
        menu; email uses your account email address.
      </p>

      {loading && <p className="mt-6 text-slate-500">Loading…</p>}

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-4 rounded border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {message}
        </p>
      )}

      {!loading && (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3 text-center">In-app</th>
                <th className="px-4 py-3 text-center">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {prefs.map((p) => (
                <tr key={p.event_key} className="bg-white">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{p.label}</p>
                    <p className="text-xs text-slate-400">{p.type}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={p.in_app}
                      onChange={() => toggle(p.event_key, 'in_app')}
                      className="h-4 w-4 rounded border-slate-300 text-teal-700"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={p.email}
                      onChange={() => toggle(p.event_key, 'email')}
                      className="h-4 w-4 rounded border-slate-300 text-teal-700"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        disabled={saving || loading}
        onClick={() => void save()}
        className="mt-6 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save preferences'}
      </button>
    </div>
  );
}
