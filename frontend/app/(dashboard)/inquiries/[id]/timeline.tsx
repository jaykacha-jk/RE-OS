'use client';

import { humanize, type InquiryHistoryEntry, type TimelineActivity } from '../../../../lib/crm';

type TimelineItem = {
  id: string;
  kind: 'activity' | 'history';
  label: string;
  detail: string | null;
  actor: string | null;
  at: string;
};

function activityLabel(a: TimelineActivity): string {
  return humanize(a.activity_type);
}

export function Timeline({
  activities,
  history,
}: {
  activities: TimelineActivity[];
  history: InquiryHistoryEntry[];
}) {
  const items: TimelineItem[] = [
    ...activities.map((a) => ({
      id: `a-${a.id}`,
      kind: 'activity' as const,
      label: activityLabel(a),
      detail: a.content,
      actor: a.actor_email,
      at: a.created_at,
    })),
    ...history.map((h) => ({
      id: `h-${h.id}`,
      kind: 'history' as const,
      label: humanize(h.change_type),
      detail: summarizeFields(h.changed_fields),
      actor: h.changed_by_email,
      at: h.created_at,
    })),
  ].sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());

  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No activity yet.</p>;
  }

  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className="relative pl-5">
          <span
            className={`absolute left-0 top-1.5 h-2 w-2 rounded-full ${
              item.kind === 'activity' ? 'bg-teal-600' : 'bg-slate-300'
            }`}
          />
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-slate-800">{item.label}</p>
            <time className="shrink-0 text-xs text-slate-400">
              {new Date(item.at).toLocaleString()}
            </time>
          </div>
          {item.detail ? <p className="text-xs text-slate-500">{item.detail}</p> : null}
          {item.actor ? <p className="text-xs text-slate-400">by {item.actor}</p> : null}
        </li>
      ))}
    </ol>
  );
}

function summarizeFields(fields: Record<string, unknown>): string | null {
  const keys = Object.keys(fields ?? {});
  if (keys.length === 0) return null;
  return keys
    .map((k) => {
      const v = fields[k] as { from?: unknown; to?: unknown } | unknown;
      if (v && typeof v === 'object' && 'to' in (v as object)) {
        const fv = v as { from?: unknown; to?: unknown };
        return `${humanize(k)}: ${String(fv.from ?? '—')} → ${String(fv.to ?? '—')}`;
      }
      return humanize(k);
    })
    .join(', ');
}
