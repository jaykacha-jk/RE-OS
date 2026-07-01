'use client';

import { useState } from 'react';

import { FormDrawer, FormField } from '../../../../components/ui';
import { apiFetch } from '../../../../lib/api';
import { getSession } from '../../../../lib/auth';
import { INQUIRY_STAGES, stageLabel, type Inquiry } from '../../../../lib/crm';

const COMMISSION_STATUSES = ['pending', 'partial', 'received', 'waived'] as const;

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
  const [bookingAmount, setBookingAmount] = useState(inquiry.booking_amount != null ? String(inquiry.booking_amount) : '');
  const [expectedCommission, setExpectedCommission] = useState(
    inquiry.expected_commission != null ? String(inquiry.expected_commission) : '',
  );
  const [receivedCommission, setReceivedCommission] = useState(
    inquiry.received_commission != null ? String(inquiry.received_commission) : '',
  );
  const [commissionStatus, setCommissionStatus] = useState(inquiry.commission_status ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isLost = stage === 'CLOSED_LOST';
  const isWon = stage === 'CLOSED_WON';
  const capturesDealEconomics = stage === 'BOOKED' || isWon;
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
          booking_amount: capturesDealEconomics && bookingAmount ? Number(bookingAmount) : undefined,
          expected_commission: capturesDealEconomics && expectedCommission ? Number(expectedCommission) : undefined,
          received_commission: capturesDealEconomics && receivedCommission ? Number(receivedCommission) : undefined,
          commission_status: capturesDealEconomics && commissionStatus ? commissionStatus : undefined,
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
    <FormDrawer
      open
      title="Change stage"
      description="Complete this quick CRM action without leaving the record."
      onClose={onClose}
      onSubmit={save}
      submitting={saving}
      error={error}
      submitLabel="Update stage"
    >
      <FormField label="Stage">
        <select value={stage} onChange={(e) => setStage(e.target.value)} className="input">
          {INQUIRY_STAGES.map((s) => (
            <option key={s} value={s}>
              {stageLabel(s)}
            </option>
          ))}
        </select>
      </FormField>
      {isLost ? (
        <FormField label="Lost reason" required>
          <input
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            className="input"
            placeholder="Required for Closed Lost (BR-C04)"
          />
        </FormField>
      ) : null}
      {needsNoPropertyReason ? (
        <FormField label="No-property reason" required>
          <input
            value={noPropertyReason}
            onChange={(e) => setNoPropertyReason(e.target.value)}
            className="input"
            placeholder="Closed Won without a linked property (BR-C03)"
          />
        </FormField>
      ) : null}
      {capturesDealEconomics ? (
        <div className="w-full basis-full rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Deal economics</p>
          <p className="mt-1 text-xs text-emerald-800">
            Capture booking and commission values so revenue dashboards reflect agency earnings.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <FormField label="Booking amount">
              <input
                type="number"
                min="0"
                value={bookingAmount}
                onChange={(e) => setBookingAmount(e.target.value)}
                className="input"
                placeholder="100000"
              />
            </FormField>
            <FormField label="Expected commission">
              <input
                type="number"
                min="0"
                value={expectedCommission}
                onChange={(e) => setExpectedCommission(e.target.value)}
                className="input"
                placeholder="250000"
              />
            </FormField>
            <FormField label="Received commission">
              <input
                type="number"
                min="0"
                value={receivedCommission}
                onChange={(e) => setReceivedCommission(e.target.value)}
                className="input"
                placeholder="0"
              />
            </FormField>
            <FormField label="Commission status">
              <select value={commissionStatus} onChange={(e) => setCommissionStatus(e.target.value)} className="input">
                <option value="">Not set</option>
                {COMMISSION_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {stageLabel(status)}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </div>
      ) : null}
    </FormDrawer>
  );
}
