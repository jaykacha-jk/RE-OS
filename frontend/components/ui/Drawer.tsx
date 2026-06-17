'use client';

import { useEffect, type ReactNode } from 'react';

import { Icon } from './icons';

export type DrawerWidth = 'sm' | 'md' | 'lg';

const WIDTH_CLASS: Record<DrawerWidth, string> = {
  sm: 'sm:max-w-[450px]',
  md: 'sm:max-w-[500px]',
  lg: 'sm:max-w-[600px]',
};

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Visual width preset. 450/500 for filters, 600 for forms. */
  width?: DrawerWidth;
  /** Sticky footer area (e.g. Clear / Apply or Cancel / Save). */
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * Base right-side slide-over used by FilterDrawer, FormDrawer and DetailDrawer.
 * Handles overlay, Escape, body scroll lock and focus containment basics so
 * every drawer in RE-OS behaves identically.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  width = 'md',
  footer,
  children,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="absolute inset-0 bg-slate-950/40 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative flex h-full w-full ${WIDTH_CLASS[width]} animate-slide-in-right flex-col bg-white shadow-premium`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-reos-border px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost -mr-1 h-8 w-8 shrink-0 p-0"
            aria-label="Close"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 pb-5 pt-0">{children}</div>

        {footer ? (
          <div className="flex items-center justify-end gap-3 border-t border-reos-border bg-slate-50 px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
