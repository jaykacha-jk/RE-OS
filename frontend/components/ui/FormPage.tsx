'use client';

import Link from 'next/link';
import type { FormEvent, ReactNode } from 'react';

import { Icon } from './icons';

export type Breadcrumb = { label: string; href?: string };

type FormPageProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  /** Trail rendered above the title, e.g. Properties → New property. */
  breadcrumbs?: Breadcrumb[];
  /** Status pill shown next to the title (e.g. a property status badge). */
  statusBadge?: ReactNode;
  onSubmit: () => void;
  submitting?: boolean;
  submitDisabled?: boolean;
  error?: string | null;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  /** Optional secondary footer action (e.g. Save Draft). */
  saveDraftLabel?: string;
  onSaveDraft?: () => void;
  children: ReactNode;
};

/**
 * Standard shell for LARGE create/edit forms (property, inquiry, organization).
 * Breadcrumb → title + status → grouped sections → sticky Cancel / Save Draft /
 * Save footer. Same footer and field system as FormDrawer so Add/Edit feel
 * identical across surfaces.
 */
export function FormPage({
  eyebrow,
  title,
  description,
  breadcrumbs,
  statusBadge,
  onSubmit,
  submitting = false,
  submitDisabled = false,
  error,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  onCancel,
  saveDraftLabel,
  onSaveDraft,
  children,
}: FormPageProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        <div className="space-y-3">
          {breadcrumbs && breadcrumbs.length ? (
            <nav className="flex flex-wrap items-center gap-1 text-xs font-medium text-slate-500" aria-label="Breadcrumb">
              {breadcrumbs.map((crumb, i) => (
                <span key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                  {crumb.href ? (
                    <Link href={crumb.href} className="transition hover:text-teal-700">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-slate-700">{crumb.label}</span>
                  )}
                  {i < breadcrumbs.length - 1 ? (
                    <Icon name="chevronRight" className="h-3.5 w-3.5 text-slate-300" />
                  ) : null}
                </span>
              ))}
            </nav>
          ) : null}

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
                {statusBadge}
              </div>
              {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="panel space-y-6 p-6">{children}</div>

        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 rounded-2xl border border-reos-border bg-white/95 px-4 py-3 shadow-card backdrop-blur sm:px-6">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
            {cancelLabel}
          </button>
          {onSaveDraft ? (
            <button type="button" className="btn-secondary" onClick={onSaveDraft} disabled={submitting}>
              {saveDraftLabel ?? 'Save draft'}
            </button>
          ) : null}
          <button type="submit" className="btn-primary" disabled={submitting || submitDisabled}>
            {submitting ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
