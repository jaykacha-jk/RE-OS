'use client';

import { FormEvent, useState } from 'react';

import { employeeLabel, type EmployeeOption } from '../../lib/crm-api';

type Props = {
  employees: EmployeeOption[];
  onAssign: (employeeId: string) => Promise<void>;
  onClose: () => void;
};

export function ChatAssignModal({ employees, onAssign, onClose }: Props) {
  const [employeeId, setEmployeeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!employeeId) return;
    setBusy(true);
    setError(null);
    try {
      await onAssign(employeeId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-900">Assign conversation</h2>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <label className="block text-sm text-slate-700">
            Employee
            <select
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            >
              <option value="">Select employee…</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {employeeLabel(emp)}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-300 px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-teal-700 px-4 py-2 text-sm text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {busy ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
