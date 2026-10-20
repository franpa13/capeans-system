import type { AppointmentStatus } from "@prisma/client";
import { APPOINTMENT_STATUS_LABELS } from "@/features/appointments/lib/status";

const CHIP_STYLES: Record<AppointmentStatus, string> = {
  CONFIRMED: "bg-primary text-primary-foreground",
  COMPLETED: "bg-emerald-600 text-white dark:bg-emerald-500",
  CANCELLED: "bg-muted-foreground/25 text-foreground",
  NO_SHOW: "bg-destructive text-white",
};

/** "Confirmado" / "Completado" / "Cancelado" / "No vino" as a small solid
 * label — the turno's state readable in words, not only by its color. */
export function StatusChip({ status }: { status: AppointmentStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-1.5 py-px text-[11px] leading-4 font-semibold ${CHIP_STYLES[status]}`}
    >
      {APPOINTMENT_STATUS_LABELS[status]}
    </span>
  );
}
