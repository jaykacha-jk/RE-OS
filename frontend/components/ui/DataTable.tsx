'use client';

import type { ReactNode } from 'react';

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  /** Cell renderer. */
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Extra classes for the cell (e.g. tabular-nums, font-semibold). */
  cellClassName?: string;
  headerClassName?: string;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  loadingRows?: number;
  /** Shown when not loading and there are no rows. */
  empty?: ReactNode;
  /** Click handler for a whole row (e.g. open detail drawer). */
  onRowClick?: (row: T) => void;
  /** Trailing action column renderer (typically an ActionMenu). */
  actions?: (row: T) => ReactNode;
};

const ALIGN: Record<NonNullable<DataTableColumn<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

/**
 * High-density enterprise table used by every list page. Compact rows,
 * standardized header styling, built-in skeleton and empty states, and an
 * optional trailing actions column for the `⋮` menu.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  loadingRows = 6,
  empty,
  onRowClick,
  actions,
}: DataTableProps<T>) {
  const totalCols = columns.length + (actions ? 1 : 0);

  if (!loading && rows.length === 0 && empty) {
    return <div className="px-5 py-10">{empty}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-2xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-2.5 font-bold ${col.align ? ALIGN[col.align] : 'text-left'} ${col.headerClassName ?? ''}`}
              >
                {col.header}
              </th>
            ))}
            {actions ? <th className="px-4 py-2.5 text-right font-bold">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: loadingRows }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`} className="border-t border-slate-100">
                  {Array.from({ length: totalCols }).map((__, colIndex) => (
                    <td key={colIndex} className="px-4 py-3">
                      <div className="h-3.5 w-full max-w-[160px] animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-t border-slate-100 ${
                    onRowClick ? 'cursor-pointer hover:bg-teal-50/40' : 'hover:bg-slate-50'
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 align-middle ${col.align ? ALIGN[col.align] : 'text-left'} ${col.cellClassName ?? ''}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                  {actions ? (
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {actions(row)}
                    </td>
                  ) : null}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
