"use client";

import { CalendarDays } from "lucide-react";
import type { TimeBlock } from "@prisma/client";

import { formatTime } from "@/features/clinic/lib/format";
import { isSameDay } from "@/features/appointments/lib/week";
import { StatusChip } from "@/features/appointments/components/status-chip";
import { TimeBlockBadge } from "@/features/appointments/components/time-block-badge";
import { ConsultaStatusIcon } from "@/features/appointments/components/consulta-status";
import type { AppointmentWithConsultation } from "@/features/clinic/data/appointments";

function dayTitle(day: Date) {
  const weekday = day.toLocaleDateString("es-AR", { weekday: "long" });
  const date = day.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${date}`;
}

/** The week as a plain list: each day with turnos (or a block) as a
 * heading, its turnos one per row in time order — time, patient, motivo,
 * state. Easier to read than a grid; a row opens the turno. */
export function AgendaList({
  days,
  appointments,
  patientsById,
  timeBlocks,
  renderTurno,
}: {
  days: Date[];
  appointments: AppointmentWithConsultation[];
  patientsById: Map<string, string>;
  timeBlocks: TimeBlock[];
  /** Wraps each row (the quick view uses it as its trigger). */
  renderTurno: (appointment: AppointmentWithConsultation, row: React.ReactNode) => React.ReactNode;
}) {
  const todayKey = new Date().toDateString();
  const sections = days
    .map((day) => {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = dayStart.getTime() + 24 * 3_600_000;
      return {
        day,
        isToday: day.toDateString() === todayKey,
        turnos: appointments
          .filter((a) => isSameDay(a.startsAt, day))
          .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
        blocks: timeBlocks.filter(
          (b) => b.startsAt.getTime() < dayEnd && b.endsAt.getTime() > dayStart.getTime(),
        ),
      };
    })
    .filter((s) => s.turnos.length > 0 || s.blocks.length > 0);

  if (sections.length === 0) {
    return (
      <div className="rounded-lg border p-8">
        <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
          <CalendarDays className="size-5" />
          No hay turnos esta semana.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-auto">
      {sections.map(({ day, isToday, turnos, blocks }) => {
        const titleId = `agenda-day-${day.getDate()}`;
        return (
          <section key={day.toISOString()} aria-labelledby={titleId} className="space-y-2">
            <h3 id={titleId} className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              {dayTitle(day)}
              {isToday && (
                <span className="rounded-full bg-primary px-2 py-px text-xs text-primary-foreground">
                  Hoy
                </span>
              )}
              <span className="font-normal text-muted-foreground">
                · {turnos.length} {turnos.length === 1 ? "turno" : "turnos"}
              </span>
            </h3>
            {blocks.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {blocks.map((block) => (
                  <TimeBlockBadge key={block.id} block={block} />
                ))}
              </div>
            )}
            {turnos.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {turnos.map((appointment) => {
                  const end = new Date(
                    appointment.startsAt.getTime() + appointment.durationMinutes * 60_000,
                  );
                  const patientName = appointment.patientId
                    ? (patientsById.get(appointment.patientId) ?? "Paciente")
                    : "Sin paciente";
                  return (
                    <li key={appointment.id}>
                      {renderTurno(
                      appointment,
                      <button
                        type="button"
                        className="flex w-full flex-col gap-1 px-3 py-2.5 text-left hover:bg-accent/40 sm:flex-row sm:items-center sm:gap-4"
                      >
                        <span className="w-28 shrink-0 font-semibold tabular-nums">
                          {formatTime(appointment.startsAt)}–{formatTime(end)}
                        </span>
                        <span className="flex min-w-0 flex-1 items-center gap-1.5 font-medium">
                          <ConsultaStatusIcon appointment={appointment} />
                          <span className="truncate">{patientName}</span>
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                          {appointment.reason || "Sin motivo"}
                        </span>
                        <StatusChip status={appointment.status} />
                      </button>,
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
