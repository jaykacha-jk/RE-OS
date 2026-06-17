'use client';

import type { ReactNode } from 'react';

import { Icon } from './icons';

type CrudToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Open the filter drawer. Omit to hide the Filter button. */
  onFilter?: () => void;
  /** Controls that should sit immediately after search and before filters. */
  controlSlot?: ReactNode;
  /** Active filter count shown as a badge: "Filter (3)". */
  filterCount?: number;
  /** Omit to hide the Export button. */
  onExport?: () => void;
  exporting?: boolean;
  /** Omit to hide the Refresh button. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Primary create affordance (e.g. an Add button, possibly permission-gated). */
  addSlot?: ReactNode;
};

/**
 * Standard list toolbar that lives INSIDE the table card. Search always sits on
 * the left; Filter / Export / Refresh / Add are consistent on the right across
 * every module so users never relearn the layout.
 */
export function CrudToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  onFilter,
  controlSlot,
  filterCount = 0,
  onExport,
  exporting = false,
  onRefresh,
  refreshing = false,
  addSlot,
}: CrudToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-reos-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <Icon name="search" className="h-4 w-4" />
        </span>
        <input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="input pl-9"
          aria-label="Search"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {controlSlot}

        {onFilter ? (
          <button type="button" onClick={onFilter} className="btn-secondary">
            <Icon name="settings" className="h-4 w-4" />
            Filter
            {filterCount > 0 ? (
              <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-reos-primary px-1.5 text-2xs font-bold text-white">
                {filterCount}
              </span>
            ) : null}
          </button>
        ) : null}

        {onExport ? (
          <button type="button" onClick={onExport} disabled={exporting} className="btn-secondary">
            <Icon name="arrowUpRight" className="h-4 w-4" />
            {exporting ? 'Exporting…' : 'Export'}
          </button>
        ) : null}

        {onRefresh ? (
          <button type="button" onClick={onRefresh} disabled={refreshing} className="btn-secondary">
            <Icon name="pulse" className="h-4 w-4" />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        ) : null}

        {addSlot}
      </div>
    </div>
  );
}
