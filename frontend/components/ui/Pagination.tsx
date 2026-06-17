'use client';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

type PaginationProps = {
  page: number;
  totalPages: number;
  /** Total row count, if known (server-side). */
  total?: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  /** Override the rows-per-page options. */
  pageSizeOptions?: readonly number[];
};

/**
 * Standard table footer: a "Rows per page" selector plus page info and
 * Prev/Next controls. Used by every list table so pagination is identical
 * platform-wide.
 */
export function Pagination({
  page,
  totalPages,
  total,
  perPage,
  onPageChange,
  onPerPageChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: PaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-reos-border px-4 py-3 text-sm text-slate-600">
      <label className="flex items-center gap-2">
        <span className="text-2xs font-bold uppercase tracking-wide text-slate-500">Rows per page</span>
        <select
          value={perPage}
          onChange={(e) => onPerPageChange(Number(e.target.value))}
          className="input w-auto py-1.5"
          aria-label="Rows per page"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <span>
          Page {page} of {Math.max(totalPages, 1)}
          {typeof total === 'number' ? ` · ${total.toLocaleString('en-IN')} total` : ''}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="btn-secondary px-3 py-1.5"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="btn-secondary px-3 py-1.5"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
