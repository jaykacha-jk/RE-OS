export type ResolvedPagination = {
  page: number;
  perPage: number;
  skip: number;
};

export function resolvePagination(
  page?: number,
  perPage?: number,
  defaultPerPage = 20,
): ResolvedPagination | null {
  if (page === undefined && perPage === undefined) return null;
  const resolvedPage = page ?? 1;
  const resolvedPerPage = Math.min(perPage ?? defaultPerPage, 100);
  return {
    page: resolvedPage,
    perPage: resolvedPerPage,
    skip: (resolvedPage - 1) * resolvedPerPage,
  };
}

export function paginationMeta(page: number, perPage: number, total: number) {
  return {
    page,
    per_page: perPage,
    total,
    total_pages: Math.max(1, Math.ceil(total / perPage)),
  };
}
