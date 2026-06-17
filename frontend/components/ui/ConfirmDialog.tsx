'use client';

import { useEffect } from 'react';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Use the danger styling for destructive actions (delete, archive). */
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Standard confirmation modal. Replaces native window.confirm() and the various
 * hand-rolled "are you sure" overlays across the app.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/40 animate-fade-in" onClick={onCancel} aria-hidden="true" />
      <div className="relative w-full max-w-md animate-scale-in rounded-2xl border border-reos-border bg-white p-6 shadow-premium">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
