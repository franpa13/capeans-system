import { CalendarClock, Mail, MessageCircle } from "lucide-react";
import type { Appointment, Patient } from "@prisma/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatTime, toLocalDateString } from "@/features/clinic/lib/format";
import { APPOINTMENT_STATUS_LABELS } from "@/features/appointments/lib/status";
import { toWhatsAppNumber } from "@/features/appointments/lib/reminder";
import { GENDERS, optionLabel } from "@/features/patients/lib/options";

const STATUS_BADGE: Record<Appointment["status"], string> = {
  CONFIRMED: "bg-primary/10 text-primary",
  WAITING: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  COMPLETED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  NO_SHOW: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
      <dt className="w-32 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center justify-between gap-2 text-sm font-medium">
        {children}
      </dd>
    </div>
  );
}

/** Resumen's "Datos personales": what's needed to reach and identify the
 * patient at a glance — the rest is on Ficha médica. */
export function PersonalDataCard({ patient }: { patient: Patient }) {
  const whatsApp = toWhatsAppNumber(patient.phone);
  const place = [patient.city, patient.province].filter(Boolean).join(", ");
  const insurance = [patient.insurance, patient.insurancePlan].filter(Boolean).join(" · ");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Datos personales
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl>
          <Row label="Tel / WhatsApp">
            <span className="truncate">{patient.phone}</span>
            {whatsApp && (
              <a
                href={`https://wa.me/${whatsApp}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Escribir por WhatsApp a ${patient.name}`}
                className="rounded-full p-1 text-[#25D366] hover:bg-[#25D366]/10"
              >
                <MessageCircle className="size-4" />
              </a>
            )}
          </Row>
          {patient.email && (
            <Row label="Email">
              <span className="truncate">{patient.email}</span>
              <a
                href={`mailto:${patient.email}`}
                aria-label={`Enviar un email a ${patient.name}`}
                className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Mail className="size-4" />
              </a>
            </Row>
          )}
          {patient.birthDate && (
            <Row label="Fecha de nac.">
              {formatDate(patient.birthDate.toISOString().slice(0, 10))}
            </Row>
          )}
          {patient.gender && <Row label="Género">{optionLabel(GENDERS, patient.gender)}</Row>}
          {place && <Row label="Ciudad">{place}</Row>}
          <Row label="Obra social">{insurance || "Particular"}</Row>
          {patient.insuranceNumber && <Row label="N° de afiliado">{patient.insuranceNumber}</Row>}
        </dl>
      </CardContent>
    </Card>
  );
}

/** Resumen's "Últimos turnos": the coming ones first, then the latest. */
export function RecentAppointmentsCard({
  appointments,
  noShows,
}: {
  appointments: Appointment[];
  noShows: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Últimos turnos
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {appointments.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="size-4" />
            Todavía no tiene turnos.
          </p>
        ) : (
          <ul>
            {appointments.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b py-2.5 text-sm last:border-b-0"
              >
                <span className="font-medium tabular-nums">
                  {formatDate(toLocalDateString(a.startsAt))}{" "}
                  <span className="text-primary">{formatTime(a.startsAt)}</span>
                </span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {a.reason || "Sin motivo"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[a.status]}`}
                >
                  {APPOINTMENT_STATUS_LABELS[a.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
        {noShows > 0 && (
          <p className="text-sm text-muted-foreground">
            Faltó a {noShows} {noShows === 1 ? "turno" : "turnos"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
