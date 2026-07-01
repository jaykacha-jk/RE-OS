'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ActionGuard } from '../../../../components/shared/ActionGuard';
import { ConfirmDialog, StatusBadge } from '../../../../components/ui';
import { apiFetch } from '../../../../lib/api';
import { getSession } from '../../../../lib/auth';
import {
  budgetLabel,
  formatINR,
  humanize,
  priorityBadgeClass,
  stageBadgeClass,
  stageLabel,
  temperatureBadgeClass,
  type Inquiry,
  type InquiryHistoryEntry,
  type TimelineActivity,
} from '../../../../lib/crm';
import { AssignModal } from './assign-modal';
import { FollowupModal } from './followup-modal';
import { SiteVisitModal } from './site-visit-modal';
import { StageModal } from './stage-modal';
import { Timeline } from './timeline';

type ModalKind = 'stage' | 'assign' | 'followup' | 'site-visit' | null;

export default function InquiryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [activities, setActivities] = useState<TimelineActivity[]>([]);
  const [history, setHistory] = useState<InquiryHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalKind>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [newNote, setNewNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const load = useCallback(() => {
    const session = getSession();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch<Inquiry>(`/api/v1/inquiries/${id}`, { token: session.access_token }),
      apiFetch<{ history: InquiryHistoryEntry[]; activities: TimelineActivity[] }>(
        `/api/v1/inquiries/${id}/history`,
        { token: session.access_token },
      ),
    ])
      .then(([detail, timeline]) => {
        setInquiry(detail.data);
        setHistory(timeline.data.history);
        setActivities(timeline.data.activities);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load inquiry'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function addNote() {
    const session = getSession();
    if (!session?.access_token || !newNote.trim()) return;
    setNoteSaving(true);
    try {
      await apiFetch(`/api/v1/inquiries/${id}/notes`, {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({ note: newNote.trim() }),
      });
      setNewNote('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setNoteSaving(false);
    }
  }

  async function updateFollowupStatus(followupId: string, status: string) {
    const session = getSession();
    if (!session?.access_token) return;
    try {
      await apiFetch(`/api/v1/inquiries/${id}/followups/${followupId}`, {
        method: 'PATCH',
        token: session.access_token,
        body: JSON.stringify({ status }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update follow-up');
    }
  }

  async function updateSiteVisitStatus(visitId: string, status: string) {
    const session = getSession();
    if (!session?.access_token) return;
    try {
      await apiFetch(`/api/v1/inquiries/${id}/site-visits/${visitId}`, {
        method: 'PATCH',
        token: session.access_token,
        body: JSON.stringify({ status }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update site visit');
    }
  }

  async function remove() {
    const session = getSession();
    if (!session?.access_token) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/v1/inquiries/${id}`, { method: 'DELETE', token: session.access_token });
      router.push('/inquiries');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete inquiry');
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  if (loading && !inquiry) return <p className="text-slate-500">Loading…</p>;
  if (error && !inquiry) return <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>;
  if (!inquiry) return null;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-xs font-medium text-slate-500" aria-label="Breadcrumb">
        <Link href="/inquiries" className="transition hover:text-teal-700">
          Inquiries
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-700">{inquiry.inquiry_code}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">{inquiry.client_name}</h1>
            <StatusBadge label={stageLabel(inquiry.stage)} className={stageBadgeClass(inquiry.stage)} />
          </div>
          <p className="mt-1 font-mono text-xs text-slate-500">{inquiry.inquiry_code} · {inquiry.phone}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionGuard permission="crm.inquiries.update" featureFlag="crm">
            <button type="button" onClick={() => setModal('stage')} className="btn-secondary">
              Change stage
            </button>
          </ActionGuard>
          <ActionGuard permission="crm.inquiries.assign" featureFlag="crm">
            <button type="button" onClick={() => setModal('assign')} className="btn-secondary">
              Assign
            </button>
          </ActionGuard>
          <ActionGuard permission="crm.inquiries.update" featureFlag="crm">
            <Link href={`/inquiries/${id}/edit`} className="btn-primary">
              Edit
            </Link>
          </ActionGuard>
          <ActionGuard permission="crm.inquiries.delete" featureFlag="crm">
            <button type="button" onClick={() => setDeleteOpen(true)} className="btn-danger">
              Delete
            </button>
          </ActionGuard>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Overview */}
          <section className="card p-5">
            <h2 className="text-h3">Overview</h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-3">
              <Field label="Phone" value={inquiry.phone} />
              <Field label="Email" value={inquiry.email} />
              <Field label="WhatsApp" value={inquiry.whatsapp} />
              <Field label="Priority">
                <StatusBadge label={humanize(inquiry.priority)} className={priorityBadgeClass(inquiry.priority)} />
              </Field>
              <Field label="Temperature">
                <StatusBadge label={humanize(inquiry.temperature)} className={temperatureBadgeClass(inquiry.temperature)} />
              </Field>
              <Field label="Lead score" value={inquiry.lead_score != null ? String(inquiry.lead_score) : null} />
              <Field label="Budget" value={budgetLabel(inquiry.budget_min, inquiry.budget_max)} />
              <Field label="Booking amount" value={formatINR(inquiry.booking_amount)} />
              <Field label="Expected commission" value={formatINR(inquiry.expected_commission)} />
              <Field label="Received commission" value={formatINR(inquiry.received_commission)} />
              <Field label="Commission status" value={inquiry.commission_status ? humanize(inquiry.commission_status) : null} />
              <Field label="Requirement" value={inquiry.requirement_type ? humanize(inquiry.requirement_type) : null} />
              <Field label="Property type" value={inquiry.property_type ? humanize(inquiry.property_type) : null} />
              <Field label="Bedrooms" value={inquiry.bedrooms != null ? String(inquiry.bedrooms) : null} />
              <Field label="Preferred location" value={inquiry.preferred_location} />
              <Field label="Timeline" value={inquiry.purchase_timeline ? humanize(inquiry.purchase_timeline) : null} />
              <Field label="Source" value={inquiry.source_name} />
              <Field label="Assignee" value={inquiry.assigned_employee_name} />
              <Field label="Property">
                {inquiry.property ? (
                  <Link href={`/properties/${inquiry.property.id}`} className="text-teal-700 hover:underline">
                    {inquiry.property.title}
                  </Link>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </Field>
            </dl>
            {inquiry.remarks ? (
              <div className="mt-4 rounded-2xl border border-reos-border bg-slate-50 p-4 text-sm text-slate-700">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Remarks</p>
                <p className="mt-1 leading-6">{inquiry.remarks}</p>
              </div>
            ) : null}
            {inquiry.lost_reason ? (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Lost reason: {inquiry.lost_reason}</p>
            ) : null}
          </section>

          {/* Follow-ups */}
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-h3">Follow-ups</h2>
              <ActionGuard permission="crm.followups.create" featureFlag="crm">
                <button type="button" onClick={() => setModal('followup')} className="btn-secondary py-1.5">
                  Add
                </button>
              </ActionGuard>
            </div>
            <div className="mt-3 space-y-2">
              {inquiry.followups && inquiry.followups.length > 0 ? (
                inquiry.followups.map((f) => (
                  <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-reos-border bg-white px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{humanize(f.followup_type)}</span>
                      <span className="ml-2 text-slate-500">
                        {f.followup_date}
                        {f.followup_time ? ` ${f.followup_time}` : ''}
                      </span>
                      {f.notes ? <p className="text-xs text-slate-400">{f.notes}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge badge-slate">{humanize(f.status)}</span>
                      {f.status === 'pending' ? (
                        <ActionGuard permission="crm.followups.update" featureFlag="crm">
                        <>
                          <button type="button" onClick={() => updateFollowupStatus(f.id, 'completed')} className="text-xs font-semibold text-teal-700 hover:underline">
                            Complete
                          </button>
                          <button type="button" onClick={() => updateFollowupStatus(f.id, 'missed')} className="text-xs font-semibold text-slate-500 hover:underline">
                            Miss
                          </button>
                        </>
                        </ActionGuard>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyCopy>No follow-ups scheduled.</EmptyCopy>
              )}
            </div>
          </section>

          {/* Site visits */}
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-h3">Site visits</h2>
              <ActionGuard permission="crm.sitevisits.create" featureFlag="crm">
                <button type="button" onClick={() => setModal('site-visit')} className="btn-secondary py-1.5">
                  Schedule
                </button>
              </ActionGuard>
            </div>
            <div className="mt-3 space-y-2">
              {inquiry.site_visits && inquiry.site_visits.length > 0 ? (
                inquiry.site_visits.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-reos-border bg-white px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{new Date(s.scheduled_at).toLocaleString()}</span>
                      {s.property ? <span className="ml-2 text-slate-500">{s.property.title}</span> : null}
                      {s.employee_name ? <p className="text-xs text-slate-400">with {s.employee_name}</p> : null}
                      {s.notes ? <p className="text-xs text-slate-400">{s.notes}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge badge-slate">{humanize(s.status)}</span>
                      {s.status === 'scheduled' ? (
                        <ActionGuard permission="crm.sitevisits.update" featureFlag="crm">
                        <>
                          <button type="button" onClick={() => updateSiteVisitStatus(s.id, 'completed')} className="text-xs font-semibold text-teal-700 hover:underline">
                            Complete
                          </button>
                          <button type="button" onClick={() => updateSiteVisitStatus(s.id, 'no_show')} className="text-xs font-semibold text-slate-500 hover:underline">
                            No show
                          </button>
                          <button type="button" onClick={() => updateSiteVisitStatus(s.id, 'cancelled')} className="text-xs font-semibold text-slate-500 hover:underline">
                            Cancel
                          </button>
                        </>
                        </ActionGuard>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyCopy>No site visits scheduled.</EmptyCopy>
              )}
            </div>
          </section>

          {/* Notes */}
          <section className="card p-5">
            <h2 className="text-h3">Notes</h2>
            <ActionGuard permission="crm.notes.create" featureFlag="crm">
              <div className="mt-3 flex gap-2">
                <input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note…"
                  className="input"
                />
                <button type="button" onClick={addNote} disabled={noteSaving || !newNote.trim()} className="btn-primary">
                  Add
                </button>
              </div>
            </ActionGuard>
            <div className="mt-3 space-y-2">
              {inquiry.notes && inquiry.notes.length > 0 ? (
                inquiry.notes.map((n) => (
                  <div key={n.id} className="rounded-2xl border border-reos-border bg-white px-3 py-2 text-sm">
                    <p className="text-slate-700">{n.note}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {n.created_by_email ?? 'system'} · {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyCopy>No notes yet.</EmptyCopy>
              )}
            </div>
          </section>
        </div>

        {/* Timeline */}
        <aside className="card p-5">
          <h2 className="text-h3">Timeline</h2>
          <div className="mt-4">
            <Timeline activities={activities} history={history} />
          </div>
        </aside>
      </div>

      {modal === 'stage' ? <StageModal inquiry={inquiry} onClose={() => setModal(null)} onDone={load} /> : null}
      {modal === 'assign' ? <AssignModal inquiry={inquiry} onClose={() => setModal(null)} onDone={load} /> : null}
      {modal === 'followup' ? <FollowupModal inquiry={inquiry} onClose={() => setModal(null)} onDone={load} /> : null}
      {modal === 'site-visit' ? <SiteVisitModal inquiry={inquiry} onClose={() => setModal(null)} onDone={load} /> : null}
      <ConfirmDialog
        open={deleteOpen}
        title="Delete this inquiry?"
        description="This is a soft delete. The inquiry will be removed from active CRM lists but retained for audit history."
        confirmLabel="Delete inquiry"
        danger
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-700">{children ?? value ?? <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}

function EmptyCopy({ children }: { children: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-reos-border bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}
