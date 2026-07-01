'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { StatusBadge } from '../../../components/ui';
import { apiFetch } from '../../../lib/api';
import { getSession, hasPermission } from '../../../lib/auth';
import {
  budgetLabel,
  humanize,
  KANBAN_COLUMNS,
  priorityBadgeClass,
  temperatureBadgeClass,
  type Inquiry,
  type InquiryStage,
} from '../../../lib/crm';

export default function PipelinePage() {
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [canUpdate, setCanUpdate] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  useEffect(() => {
    setCanUpdate(hasPermission(getSession(), 'crm.inquiries.update'));
  }, []);

  const load = useCallback(() => {
    const session = getSession();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    apiFetch<Inquiry[]>('/api/v1/inquiries?per_page=100&sort_by=updated_at&sort_dir=desc', {
      token: session.access_token,
    })
      .then((res) => setRows(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load pipeline'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function moveTo(inquiry: Inquiry, stage: InquiryStage) {
    if (inquiry.stage === stage) return;
    const session = getSession();
    if (!session?.access_token) return;

    const body: Record<string, unknown> = { stage };
    if (stage === 'CLOSED_LOST') {
      const reason = window.prompt('Lost reason (required for Closed Lost):');
      if (!reason) return;
      body.lost_reason = reason;
    }
    if (stage === 'CLOSED_WON' && !inquiry.property_id) {
      const reason = window.prompt('No linked property — reason for Closed Won:');
      if (!reason) return;
      body.no_property_reason = reason;
    }

    // Optimistic update
    setRows((prev) => prev.map((r) => (r.id === inquiry.id ? { ...r, stage } : r)));
    try {
      await apiFetch(`/api/v1/inquiries/${inquiry.id}/stage`, {
        method: 'PATCH',
        token: session.access_token,
        body: JSON.stringify(body),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stage change failed');
      load();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline</h1>
          <p className="mt-1 text-sm text-slate-600">
            {canUpdate ? 'Drag cards between stages to move leads. Each move is recorded in history.' : 'Read-only view of your pipeline.'}
          </p>
        </div>
        <Link href="/inquiries" className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          List view
        </Link>
      </div>

      {error ? <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="mt-6 text-slate-500">Loading…</p> : null}

      <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((col) => {
          const cards = rows.filter((r) => r.stage === col.stage);
          const isTarget = dropTarget === col.stage;
          return (
            <div
              key={col.stage}
              onDragOver={(e) => {
                if (!canUpdate || !dragId) return;
                e.preventDefault();
                setDropTarget(col.stage);
              }}
              onDragLeave={() => setDropTarget((t) => (t === col.stage ? null : t))}
              onDrop={(e) => {
                e.preventDefault();
                setDropTarget(null);
                const card = rows.find((r) => r.id === dragId);
                setDragId(null);
                if (card) moveTo(card, col.stage);
              }}
              className={`flex w-72 shrink-0 flex-col rounded-lg border ${
                isTarget ? 'border-teal-400 bg-teal-50' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                <span className="text-sm font-semibold text-slate-700">{col.label}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{cards.length}</span>
              </div>
              <div className="flex-1 space-y-2 p-2">
                {cards.map((card) => (
                  <div
                    key={card.id}
                    draggable={canUpdate}
                    onDragStart={() => setDragId(card.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setDropTarget(null);
                    }}
                    className={`rounded border border-slate-200 bg-white p-3 text-sm shadow-sm ${
                      canUpdate ? 'cursor-grab active:cursor-grabbing' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/inquiries/${card.id}`} className="font-medium text-teal-800 hover:underline">
                        {card.client_name}
                      </Link>
                      <StatusBadge size="compact" label={humanize(card.temperature)} className={temperatureBadgeClass(card.temperature)} />
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-slate-400">{card.inquiry_code}</p>
                    <p className="mt-1 text-xs text-slate-500">{budgetLabel(card.budget_min, card.budget_max)}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <StatusBadge size="compact" label={humanize(card.priority)} className={priorityBadgeClass(card.priority)} />
                      <span className="truncate text-[10px] text-slate-400">{card.assigned_employee_name ?? 'Unassigned'}</span>
                    </div>
                  </div>
                ))}
                {cards.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-slate-400">No leads</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
