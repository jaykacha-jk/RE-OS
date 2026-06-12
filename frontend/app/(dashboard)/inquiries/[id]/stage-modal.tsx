'use client';

import { useState } from 'react';

import { apiFetch } from '../../../../lib/api';
import { getSession } from '../../../../lib/auth';
import { INQUIRY_STAGES, stageLabel, type Inquiry } from '../../../../lib/crm';
import { ModalShell } from './modal-shell';

const inputClass = 'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm';

export function StageModal({
  inquiry,
  onClose,
  onDone,
}: {
  inquiry: Inquiry;
  onClose: () => void;
  onDone: () => void;
}) {
  const [stage, setStage] = useState(inquiry.stage);
  const [lostReason, setLostReason] = useState('');
  const [noPropertyReason, setNoPropertyReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isLost = stage === 'CLOSED_LOST';
  const isWon = stage === 'CLOSED_WON';
  const needsNoPropertyReason = isWon && !inquiry.property_id;

  async function save() {
    const session = getSession();
    if (!session?.access_token) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/inquiries/${inquiry.id}/stage`, {
        method: 'PATCH',
        token: session.access_token,
        body: JSON.stringify({
          stage,
          lost_reason: isLost ? lostReason.trim() || undefined : undefined,
          no_property_reason: needsNoPropertyReason ? noPropertyReason.trim() || undefined : undefined,
        }),
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change stage');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Change stage" onClose={onClose} onSave={save} saving={saving} error={error} saveLabel="Update stage">
      <div>
        <label className="block text-sm font-medium text-slate-700">Stage</label>
        <select value={stage} onChange={(e) => setStage(e.target.value)} className={inputClass}>
          {INQUIRY_STAGES.map((s) => (
            <option key={s} value={s}>{stageLabel(s)}</option>
          ))}
        </select>
      </div>
      {isLost ? (
        <div>
          <label className="block text-sm font-medium text-slate-700">Lost reason *</label>
          <input value={lostReason} onChange={(e) => setLostReason(e.target.value)} className={inputClass} placeholder="Required for Closed Lost (BR-C04)" />
        </div>
      ) : null}
      {needsNoPropertyReason ? (
        <div>
          <label className="block text-sm font-medium text-slate-700">No-property reason *</label>
          <input value={noPropertyReason} onChange={(e) => setNoPropertyReason(e.target.value)} className={inputClass} placeholder="Closed Won without a linked property (BR-C03)" />
        </div>
      ) : null}
    </ModalShell>
  );
}
