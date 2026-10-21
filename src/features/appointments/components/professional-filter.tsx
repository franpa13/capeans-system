"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { professionalLabel, useProfessionals } from "@/features/clinic/components/permissions-provider";

const EVERYONE = "__all__";

/** Whose agenda shows: everyone's, or one professional's — kept in the
 * `prof` URL param like the estado filter. Only when there's more than
 * one professional to choose from. */
export function ProfessionalFilter({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const professionals = useProfessionals();
  if (professionals.length < 2) return null;

  return (
    <Select
      value={value || EVERYONE}
      onValueChange={(next) => {
        const params = new URLSearchParams(searchParams.toString());
        if (next === EVERYONE) params.delete("prof");
        else params.set("prof", next);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }}
    >
      <SelectTrigger aria-label="Profesional" className="w-full sm:w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EVERYONE}>Todos los profesionales</SelectItem>
        {professionals.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {professionalLabel(p)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
