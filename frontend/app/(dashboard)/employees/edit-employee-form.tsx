'use client';

import { useEffect, useState } from 'react';

import { FormDrawer, FormField, FormSection, PhoneInput } from '../../../components/ui';
import { apiFetch } from '../../../lib/api';
import { getSession } from '../../../lib/auth';
import { isValidIndianMobile, parseNationalDigits, toE164 } from '../../../lib/phone';

const ROLES = ['org_admin', 'sales_manager', 'sales_executive', 'telecaller'] as const;
const STATUSES = ['active', 'inactive'] as const;

type EmployeeRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role_code: string | null;
  status: string;
};

type EmployeeDetail = EmployeeRow & {
  phone: string | null;
};

export function EditEmployeeForm({
  employee,
  open,
  onClose,
  onSaved,
}: {
  employee: EmployeeRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleCode, setRoleCode] = useState<(typeof ROLES)[number]>('sales_executive');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('active');

  useEffect(() => {
    if (!open || !employee) return;

    const session = getSession();
    if (!session?.access_token) return;

    setHydrating(true);
    setError(null);
    apiFetch<EmployeeDetail>(`/api/v1/employees/${employee.id}`, { token: session.access_token })
      .then((res) => {
        const row = res.data;
        setFirstName(row.first_name ?? '');
        setLastName(row.last_name ?? '');
        setEmail(row.email);
        setPhone(row.phone ?? '');
        setRoleCode((row.role_code as (typeof ROLES)[number]) ?? 'sales_executive');
        setStatus((row.status as (typeof STATUSES)[number]) ?? 'active');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load employee'))
      .finally(() => setHydrating(false));
  }, [open, employee]);

  async function onSubmit() {
    const session = getSession();
    if (!session?.access_token || !employee) return;

    if (phone.trim() && !isValidIndianMobile(parseNationalDigits(phone))) {
      setError('Please match the requested format.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiFetch(`/api/v1/employees/${employee.id}`, {
        method: 'PATCH',
        token: session.access_token,
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim() ? toE164(parseNationalDigits(phone)) : undefined,
          role_code: roleCode,
          status,
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="Edit employee"
      description="Update team member details, role, and workspace status."
      onSubmit={onSubmit}
      submitting={loading || hydrating}
      error={error}
      submitLabel="Save changes"
    >
      {hydrating ? (
        <p className="text-sm text-slate-500">Loading employee…</p>
      ) : (
        <FormSection compact>
          <FormField label="First name" required>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="input" />
          </FormField>
          <FormField label="Last name" required>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} required className="input" />
          </FormField>
          <FormField label="Email" full hint="Email cannot be changed here.">
            <input value={email} readOnly disabled className="input disabled:bg-slate-50 disabled:text-slate-500" />
          </FormField>
          <FormField label="Phone" full>
            <PhoneInput value={phone} onChange={setPhone} />
          </FormField>
          <FormField label="Role" required>
            <select
              value={roleCode}
              onChange={(e) => setRoleCode(e.target.value as (typeof ROLES)[number])}
              required
              className="input"
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Status" required>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
              required
              className="input"
            >
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </FormField>
        </FormSection>
      )}
    </FormDrawer>
  );
}
