'use client';

import type { FormEvent, ReactNode } from 'react';

import { Drawer } from './Drawer';

type FormDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  onSubmit: () => void;
  submitting?: boolean;
  /** Top-level error banner shown above the fields. */
  error?: string | null;
  submitLabel?: string;
  cancelLabel?: string;
  /** Optional secondary footer action, e.g. Save & add another. */
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  children: ReactNode;
};

/**
 * Standard 600px drawer for SMALL create/edit forms (lead sources, employees,
 * pipeline stages, etc). Sticky Cancel / Save footer matches FormPage so the Add
 * and Edit experiences feel identical regardless of surface.
 */
export function FormDrawer({
  open,
  onClose,
  title,
  description,
  onSubmit,
  submitting = false,
  error,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  secondaryActionLabel,
  onSecondaryAction,
  children,
}: FormDrawerProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      width="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
            {cancelLabel}
          </button>
          {onSecondaryAction ? (
            <button type="button" className="btn-secondary" onClick={onSecondaryAction} disabled={submitting}>
              {secondaryActionLabel ?? 'Save and continue'}
            </button>
          ) : null}
          <button type="submit" form="form-drawer" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : submitLabel}
          </button>
        </>
      }
    >
      <form id="form-drawer" onSubmit={handleSubmit} className="m-0 space-y-4">
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        {children}
      </form>
    </Drawer>
  );
}
