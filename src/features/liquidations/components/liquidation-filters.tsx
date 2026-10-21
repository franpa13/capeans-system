"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LIQUIDATION_MODES, type LiquidationMode } from "@/features/clinic/lib/liquidations";

const ALL = "__all__";

/** Narrows the liquidaciones by professional and mode (URL params). */
export function LiquidationFilters({
  professionals,
  professionalId,
  mode,
}: {
  professionals: { id: string; label: string }[];
  professionalId: string;
  mode: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function set(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL) params.delete(key);
    else params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="filterProfessional">Profesional</Label>
        <Select value={professionalId || ALL} onValueChange={(v) => set("profesional", v)}>
          <SelectTrigger id="filterProfessional" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            {professionals.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="filterMode">Modo</Label>
        <Select value={mode || ALL} onValueChange={(v) => set("modo", v)}>
          <SelectTrigger id="filterMode" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            {(Object.keys(LIQUIDATION_MODES) as LiquidationMode[]).map((m) => (
              <SelectItem key={m} value={m}>
                {LIQUIDATION_MODES[m].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
