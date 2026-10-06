/** How many pages a list of this many items splits into, at this page
 * size — always at least 1, even for an empty list, so "Página 1 de 1"
 * is a valid, non-broken state to render. */
export function pageCountFor(itemCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(itemCount / pageSize));
}

/** The slice of items to show on a given (1-indexed) page. */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
