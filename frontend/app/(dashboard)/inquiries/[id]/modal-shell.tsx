'use client';

import type { ReactNode } from 'react';

import { Drawer } from '../../../../components/ui';

export function ModalShell({
  title,
  children,
  onClose,
  onSave,
  saving,
  error,
  saveLabel = 'Save',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
  saveLabel?: string;
}) {
  return (
    <Drawer
      open
      onClose={onClose}
      title={title}
      description="Complete this quick CRM action without leaving the record."
      width="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={onSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : saveLabel}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        {children}
      </div>
    </Drawer>
  );
}
