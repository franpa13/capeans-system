"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_STATUSES } from "@/features/appointments/lib/status";

const OPTIONS = [
  { value: "CONFIRMED", label: "Turnos confirmados" },
  { value: "CANCELLED", label: "Turnos cancelados" },
  { value: "COMPLETED", label: "Turnos completados" },
  { value: ALL_STATUSES, label: "Todos los turnos" },
] as const;

/** Which turnos show in the grid — cancelled ones are hidden by default
 * (DEFAULT_STATUS), since a cancelled slot isn't actually happening that
 * day; this lets the dentist switch to see them (or any other status)
 * deliberately instead. Applies to both the Semanal and Diario views,
 * which both read the same `estado` URL param from the Server Component
 * above and so stay in sync with each other automatically. */
export function AppointmentStatusFilter({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("estado", next);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }}
    >
      <SelectTrigger className="w-full sm:w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
