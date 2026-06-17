'use client';

import type { ReactNode } from 'react';

import { Drawer } from './Drawer';

type FilterDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** Commit the current draft filters (then the drawer closes). */
  onApply: () => void;
  /** Reset all filters to empty. */
  onClear: () => void;
  /** Filter controls — typically a stack of <FilterField>. */
  children: ReactNode;
  title?: string;
};

/**
 * Right-side filter drawer (500px) shared by every list page. The page owns the
 * draft filter state and passes Apply/Clear handlers; this component only
 * standardizes the chrome and the Clear / Apply footer.
 */
export function FilterDrawer({
  open,
  onClose,
  onApply,
  onClear,
  children,
  title = 'Filters',
}: FilterDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      description="Refine this list. Filters sync to the URL so views are shareable."
      width="md"
      footer={
        <>
          <button type="button" className="btn-ghost mr-auto" onClick={onClear}>
            Clear filters
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              onApply();
              onClose();
            }}
          >
            Apply filters
          </button>
        </>
      }
    >
      <div className="space-y-4">{children}</div>
    </Drawer>
  );
}

export function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
