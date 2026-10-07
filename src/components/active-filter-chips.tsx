"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type FilterChip = {
  key: string;
  label: string;
  onRemove: () => void;
};

/** One removable chip per active filter, so it's obvious at a glance which
 * filters are narrowing the list and each can be cleared on its own —
 * complements "Limpiar filtros" (which clears all of them at once) rather
 * than replacing it. Renders nothing when there are no active filters. */
export function ActiveFilterChips({ chips }: { chips: FilterChip[] }) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <Badge key={chip.key} variant="secondary" className="gap-1 py-1 pr-1 pl-2.5 font-normal">
          {chip.label}
          <button
            type="button"
            aria-label={`Quitar filtro ${chip.label}`}
            onClick={chip.onRemove}
            className="rounded-full p-0.5 hover:bg-muted-foreground/20"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}
