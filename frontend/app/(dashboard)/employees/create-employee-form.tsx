'use client';

import { useState } from 'react';

import { FormDrawer, FormField, FormSection, PhoneInput } from '../../../components/ui';
import { QuotaNotice, quotaApiNoticeProps } from '../../../components/billing/quota-notice';
import { isValidIndianMobile, parseNationalDigits, toE164 } from '../../../lib/phone';
import { apiFetch } from '../../../lib/api';
import { getSession } from '../../../lib/auth';
import { parseQuotaApiError, type QuotaErrorDetails } from '../../../lib/quota';

const ROLES = [
  'org_admin',
  'sales_manager',
  'sales_executive',
  'telecaller',
] as const;

type CreateEmployeeResponse = {
  employee: {
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
  invitation_sent: boolean;
  invitation_email_status?: string;
  invitation_pending: boolean;
  accept_url?: string;
  expires_at?: string;
};

export function CreateEmployeeForm({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<QuotaErrorDetails | null>(null);
  const [invite, setInvite] = useState<CreateEmployeeResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleCode, setRoleCode] = useState<(typeof ROLES)[number]>('sales_executive');

  async function onSubmit() {
    const session = getSession();
    if (!session?.access_token) return;

    if (phone.trim() && !isValidIndianMobile(parseNationalDigits(phone))) {
      setError('Please match the requested format.');
      return;
    }

    setLoading(true);
    setError(null);
    setQuotaError(null);
    setInvite(null);
    setCopied(false);

    try {
      const { data } = await apiFetch<CreateEmployeeResponse>('/api/v1/employees', {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() ? toE164(parseNationalDigits(phone)) : undefined,
          role_code: roleCode,
        }),
      });
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setRoleCode('sales_executive');
      setInvite(data);
      onCreated();
    } catch (err) {
      const parsed = parseQuotaApiError(err);
      if (parsed) {
        setQuotaError(parsed);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Create failed');
      }
    } finally {
      setLoading(false);
    }
  }

  async function copyInviteLink() {
    if (!invite?.accept_url) return;
    await navigator.clipboard.writeText(invite.accept_url);
    setCopied(true);
  }

  return (
    <FormDrawer
      open={open}
      onClose={() => {
        onClose();
        setInvite(null);
        setError(null);
        setQuotaError(null);
      }}
      title="Add employee"
      description="Invite a tenant-scoped team member and assign their operating role."
      onSubmit={onSubmit}
      submitting={loading}
      error={error}
      submitLabel="Create employee"
    >
      {quotaError ? <QuotaNotice {...quotaApiNoticeProps(quotaError)} /> : null}
      <FormSection compact>
        <FormField label="First name" required>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="input" />
        </FormField>
        <FormField label="Last name" required>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} required className="input" />
        </FormField>
        <FormField label="Email" required full>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="input" />
        </FormField>
        <FormField label="Phone" full>
          <PhoneInput value={phone} onChange={setPhone} />
        </FormField>
        <FormField label="Role" required full>
          <select value={roleCode} onChange={(e) => setRoleCode(e.target.value as (typeof ROLES)[number])} required className="input">
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </FormField>
      </FormSection>

      {invite ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">
            Invitation {invite.invitation_sent ? 'email queued' : 'created'}
          </p>
          <p className="mt-1">
            {invite.employee.email} can accept the invitation from their email.
          </p>
          {invite.expires_at ? (
            <p className="mt-1 text-xs text-emerald-700">
              Link expires {new Date(invite.expires_at).toLocaleString()}.
            </p>
          ) : null}
          {invite.accept_url ? (
            <div className="mt-3 rounded border border-emerald-200 bg-white p-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Copy invite link fallback
              </p>
              <p className="mt-1 break-all font-mono text-xs text-slate-700">{invite.accept_url}</p>
              <button
                type="button"
                onClick={copyInviteLink}
                className="mt-2 rounded border border-emerald-300 px-3 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
              >
                {copied ? 'Copied' : 'Copy invite link'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </FormDrawer>
  );
}
