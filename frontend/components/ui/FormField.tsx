'use client';

import { useState, type ReactNode } from 'react';

import { Icon } from './icons';

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  /** Span both columns inside a FormSection grid. */
  full?: boolean;
  children: ReactNode;
};

/**
 * Standard labelled field used by every form (drawer or full page). Provides
 * consistent label typography, required marker, hint and error rendering.
 */
export function FormField({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  full = false,
  children,
}: FormFieldProps) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
        {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      {error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}

type FormSectionProps = {
  title?: string;
  description?: string;
  /** Render a collapse/expand control. */
  collapsible?: boolean;
  /** Initial open state for collapsible sections. Defaults to open. */
  defaultOpen?: boolean;
  /** Optional trailing content in the header (e.g. a small badge or hint). */
  aside?: ReactNode;
  /** Skip section title chrome — use inside drawers that already have a header. */
  compact?: boolean;
  children: ReactNode;
};

/**
 * A titled group of fields. Fields are laid out on a responsive two-column grid;
 * use FormField `full` to span both columns. Sections can be made `collapsible`
 * for progressive disclosure of advanced fields (e.g. SEO, configuration).
 */
export function FormSection({
  title,
  description,
  collapsible = false,
  defaultOpen = true,
  aside,
  compact = false,
  children,
}: FormSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = collapsible ? open : true;

  if (compact) {
    return <section className="grid gap-4 sm:grid-cols-2">{children}</section>;
  }

  return (
    <section className="border-b border-reos-border pb-6 last:border-0 last:pb-0">
      <div className="mb-4 flex items-start justify-between gap-3">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="group flex items-start gap-2 text-left"
            aria-expanded={isOpen}
          >
            <Icon
              name="chevronRight"
              className={`mt-1 h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
            />
            <span>
              <span className="text-h3 group-hover:text-teal-700">{title}</span>
              {description ? <span className="mt-1 block text-xs text-slate-500">{description}</span> : null}
            </span>
          </button>
        ) : (
          <div>
            <h3 className="text-h3">{title}</h3>
            {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
          </div>
        )}
        {aside}
      </div>
      {isOpen ? <div className="grid gap-4 sm:grid-cols-2">{children}</div> : null}
    </section>
  );
}
