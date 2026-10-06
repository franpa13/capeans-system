"use client";

import { useState } from "react";
import { pageCountFor, paginate } from "@/lib/pagination";

/** Client-side pagination over an already-filtered list: slices `items`
 * into pages of `pageSize`, and resets to page 1 whenever `items` itself
 * changes (e.g. a filter was applied) so the view never lands on a page
 * that no longer makes sense for the new result set.
 *
 * Resets during render (comparing against the previous `items` reference)
 * rather than in a useEffect — React's own recommended pattern for
 * "adjust state when a prop changes": it re-renders immediately with the
 * corrected state instead of committing a stale page and only fixing it
 * on a second pass. */
export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setPage(1);
  }

  const pageCount = pageCountFor(items.length, pageSize);
  // Clamp defensively (e.g. the list shrank from underneath a page that
  // no longer exists) rather than rendering a blank page.
  const safePage = Math.min(page, pageCount);

  return {
    page: safePage,
    setPage,
    pageCount,
    pageItems: paginate(items, safePage, pageSize),
  };
}
