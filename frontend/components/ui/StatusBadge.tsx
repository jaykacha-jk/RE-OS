import type { ReactNode } from 'react';

const SIZE_CLASS = {
  default: 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
  compact: 'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
} as const;

/** Shared status pill — pass `className` from domain *BadgeClass helpers in lib/. */
export function StatusBadge({
  label,
  className = 'bg-slate-100 text-slate-600',
  size = 'default',
}: {
  label: ReactNode;
  className?: string;
  size?: keyof typeof SIZE_CLASS;
}) {
  return <span className={`${SIZE_CLASS[size]} ${className}`}>{label}</span>;
}
