"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Keeps a set of filters in sync with the URL's query string, immune to
 * the race a naive "read window.location, patch one param, write it back"
 * setter runs into: router.replace() is asynchronous, so two filters
 * changed close together can each read a URL the other's navigation
 * hasn't committed to yet, and the later write silently wins with an
 * incomplete picture (observed: picking an "obra social" right after
 * clearing the name filter dropped the obra social param entirely).
 *
 * Instead, every filter's value lives in one local state object that's the
 * single source of truth while the page is open; every navigation is
 * built from that whole object in one synchronous `setValues` update,
 * never by reading back the URL — so "set a" then "set b" always compose
 * into "a and b", regardless of how long either navigation takes to land.
 *
 * Debounced keys (free-text inputs) share one timer: typing in one
 * reschedules it with every field's latest value, not just its own.
 * Non-debounced keys (selects, dates) navigate immediately and flush any
 * pending debounce, so a fast-moving user never has a stale edit undone. */
export function useUrlFilters<K extends string>(
  paramKeys: readonly K[],
  debouncedKeys: readonly K[] = [],
  delayMs = 300,
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [values, setValues] = useState<Record<K, string>>(
    () =>
      Object.fromEntries(paramKeys.map((k) => [k, searchParams.get(k) ?? ""])) as Record<
        K,
        string
      >,
  );

  const navigate = (next: Record<K, string>) => {
    const params = new URLSearchParams();
    for (const key of paramKeys) {
      if (next[key]) params.set(key, next[key]);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const setValue = (key: K, value: string) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (debouncedKeys.includes(key)) {
        timeoutRef.current = setTimeout(() => navigate(next), delayMs);
      } else {
        navigate(next);
      }
      return next;
    });
  };

  const clear = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setValues(Object.fromEntries(paramKeys.map((k) => [k, ""])) as Record<K, string>);
    router.replace(pathname, { scroll: false });
  };

  return { values, setValue, clear };
}
