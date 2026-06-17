'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export type ActionMenuItem = {
  label: string;
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Hide the item entirely (e.g. permission denied). */
  hidden?: boolean;
};

type ActionMenuProps = {
  items: ActionMenuItem[];
  /** Accessible label for the trigger. */
  label?: string;
};

/**
 * The single row-action affordance for every table: a `⋮` trigger that opens a
 * compact menu. Replaces inline View/Edit/Delete buttons platform-wide.
 */
export function ActionMenu({ items, label = 'Row actions' }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visible = items.filter((item) => !item.hidden);
  if (visible.length === 0) return null;

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost h-8 w-8 p-0"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-44 origin-top-right animate-scale-in overflow-hidden rounded-xl border border-reos-border bg-white py-1 shadow-dropdown"
        >
          {visible.map((item, index) => {
            const className = `block w-full px-3 py-2 text-left text-sm transition ${
              item.danger
                ? 'text-rose-600 hover:bg-rose-50'
                : 'text-slate-700 hover:bg-slate-50'
            } ${item.disabled ? 'cursor-not-allowed opacity-50' : ''}`;

            if (item.href && !item.disabled) {
              return (
                <Link
                  key={`${item.label}-${index}`}
                  href={item.href}
                  role="menuitem"
                  className={className}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              );
            }

            return (
              <button
                key={`${item.label}-${index}`}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={className}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
