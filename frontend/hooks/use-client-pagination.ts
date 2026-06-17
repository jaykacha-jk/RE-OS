'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * Client-side pagination for tables that load their full dataset up front.
 * Mirrors the server-paginated shape (page/perPage/totalPages) so the shared
 * Pagination component can be used identically.
 */
export function useClientPagination<T>(rows: T[], defaultPerPage = 20) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(defaultPerPage);

  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));

  // Clamp the page if the dataset shrinks (e.g. after filtering/deleting).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * perPage;
    return rows.slice(start, start + perPage);
  }, [rows, page, perPage]);

  function changePerPage(next: number) {
    setPerPage(next);
    setPage(1);
  }

  return {
    page,
    perPage,
    totalPages,
    total: rows.length,
    pageRows,
    setPage,
    setPerPage: changePerPage,
  };
}
