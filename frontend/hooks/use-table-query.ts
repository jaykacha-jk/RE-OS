'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type TableQueryValues = Record<string, string>;

type UseTableQueryOptions = {
  /** Keys that the page treats as filters (everything except search/page/sort). */
  filterKeys: string[];
  /** Param name used for the free-text search box. Defaults to `search`. */
  searchKey?: string;
  /** Debounce in ms before a search keystroke is pushed to the URL. */
  debounceMs?: number;
  /** Default values applied when a key is absent from the URL. */
  defaults?: TableQueryValues;
  /** Default rows-per-page when `per_page` is absent from the URL. */
  defaultPerPage?: number;
};

/**
 * Standardized list-page query state. Single source of truth is the URL, so
 * filters/search/sort/page are shareable, bookmarkable, and back-button safe.
 * Search input is debounced before it touches the URL to avoid request storms.
 */
export function useTableQuery({
  filterKeys,
  searchKey = 'search',
  debounceMs = 350,
  defaults = {},
  defaultPerPage = 20,
}: UseTableQueryOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const read = useCallback(
    (key: string) => searchParams.get(key) ?? defaults[key] ?? '',
    [searchParams, defaults],
  );

  const commit = useCallback(
    (next: TableQueryValues, { resetPage = true }: { resetPage?: boolean } = {}) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value === '' || value == null) params.delete(key);
        else params.set(key, value);
      }
      if (resetPage) params.delete('page');
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // Local search box value mirrors the URL but updates instantly for the user;
  // the debounced effect below pushes it to the URL.
  const urlSearch = searchParams.get(searchKey) ?? '';
  const [searchInput, setSearchInput] = useState(urlSearch);
  const lastPushed = useRef(urlSearch);

  useEffect(() => {
    // Keep local state in sync when the URL changes externally (back/forward).
    if (urlSearch !== lastPushed.current) {
      setSearchInput(urlSearch);
      lastPushed.current = urlSearch;
    }
  }, [urlSearch]);

  useEffect(() => {
    if (searchInput === lastPushed.current) return;
    const handle = setTimeout(() => {
      lastPushed.current = searchInput;
      commit({ [searchKey]: searchInput });
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [searchInput, searchKey, debounceMs, commit]);

  const filters = useMemo(() => {
    const out: TableQueryValues = {};
    for (const key of filterKeys) out[key] = read(key);
    return out;
  }, [filterKeys, read]);

  const activeFilterCount = useMemo(
    () => filterKeys.reduce((count, key) => (read(key) ? count + 1 : count), 0),
    [filterKeys, read],
  );

  const applyFilters = useCallback(
    (next: TableQueryValues) => commit(next),
    [commit],
  );

  const clearFilters = useCallback(() => {
    const cleared: TableQueryValues = {};
    for (const key of filterKeys) cleared[key] = '';
    commit(cleared);
  }, [filterKeys, commit]);

  const page = Number(searchParams.get('page') ?? '1') || 1;
  const setPage = useCallback(
    (next: number) => commit({ page: String(next) }, { resetPage: false }),
    [commit],
  );

  const perPage = Number(searchParams.get('per_page') ?? String(defaultPerPage)) || defaultPerPage;
  const setPerPage = useCallback(
    (next: number) => commit({ per_page: String(next) }),
    [commit],
  );

  const setSort = useCallback(
    (sortBy: string, sortDir: string) =>
      commit({ sort_by: sortBy, sort_dir: sortDir }),
    [commit],
  );

  return {
    /** Free-text search box value (instant) and its setter. */
    searchInput,
    setSearchInput,
    /** Debounced search currently reflected in the URL. */
    search: urlSearch,
    /** Current filter values keyed by filterKeys. */
    filters,
    /** Number of non-empty filters (excludes search), for the Filter (N) badge. */
    activeFilterCount,
    /** Push a set of filter values to the URL (resets page to 1). */
    applyFilters,
    /** Clear all filters (and reset page). */
    clearFilters,
    page,
    setPage,
    /** Rows-per-page reflected in the URL (`per_page`). */
    perPage,
    /** Set rows-per-page (resets page to 1). */
    setPerPage,
    sortBy: searchParams.get('sort_by') ?? defaults.sort_by ?? '',
    sortDir: searchParams.get('sort_dir') ?? defaults.sort_dir ?? '',
    setSort,
    /** Read a single param (filter, sort, etc). */
    read,
    /** Low-level commit for custom params. */
    commit,
  };
}
