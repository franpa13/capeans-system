import { ClipboardCheck, ClipboardX } from "lucide-react";
import type { AppointmentWithConsultation } from "@/features/clinic/data/appointments";

type ConsultaStatus = "registered" | "missing";

export const CONSULTA_STATUS_LABELS: Record<ConsultaStatus, string> = {
  registered: "Consulta registrada",
  missing: "Falta registrar la consulta",
};

/** Only completed turnos with a patient get a status: a confirmed turno
 * hasn't happened yet and a cancelled one never will, so neither "owes"
 * a consulta. */
export function consultaStatus(appointment: AppointmentWithConsultation): ConsultaStatus | null {
  if (appointment.status !== "COMPLETED" || !appointment.patientId) return null;
  return appointment.consultation ? "registered" : "missing";
}

export function ConsultaStatusIcon({ appointment }: { appointment: AppointmentWithConsultation }) {
  const status = consultaStatus(appointment);
  if (!status) return null;
  const Icon = status === "registered" ? ClipboardCheck : ClipboardX;
  return (
    <span role="img" aria-label={CONSULTA_STATUS_LABELS[status]} title={CONSULTA_STATUS_LABELS[status]}>
      <Icon
        aria-hidden
        className={`size-3 shrink-0 ${status === "missing" ? "text-destructive" : ""}`}
      />
    </span>
  );
}
