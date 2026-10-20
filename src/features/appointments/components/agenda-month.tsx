"use client";

import Link from "next/link";
import type { AppointmentStatus, BusinessHours, TimeBlock } from "@prisma/client";

import { addDays, getWeekStart, isSameDay } from "@/features/appointments/lib/week";
import { businessHoursForWeekday, closedRanges } from "@/features/appointments/lib/business-hours";
import { APPOINTMENT_STATUS_LABELS } from "@/features/appointments/lib/status";
import { TimeBlockBadge } from "@/features/appointments/components/time-block-badge";
import { formatTime } from "@/features/clinic/lib/format";
import type { AppointmentWithConsultation } from "@/features/clinic/data/appointments";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MAX_PER_DAY = 3;

/** The state as the color of the row's left edge (and the legend's dots). */
const STATUS_EDGE: Record<AppointmentStatus, string> = {
  CONFIRMED: "border-l-primary",
  WAITING: "border-l-amber-500",
  COMPLETED: "border-l-emerald-600",
  NO_SHOW: "border-l-destructive",
  CANCELLED: "border-l-muted-foreground/50",
};
const STATUS_DOT: Record<AppointmentStatus, string> = {
  CONFIRMED: "bg-primary",
  WAITING: "bg-amber-500",
  COMPLETED: "bg-emerald-600",
  NO_SHOW: "bg-destructive",
  CANCELLED: "bg-muted-foreground/50",
};
const LEGEND: AppointmentStatus[] = ["CONFIRMED", "WAITING", "COMPLETED", "NO_SHOW", "CANCELLED"];

/** The month as a Mon–Sun grid: each day shows up to three turnos
 * ("09:00 Paciente", edged in its state's color) and "+N más" for the
 * rest, which — like the day number — opens that day in the Día view. */
export function AgendaMonth({
  monthStart,
  appointments,
  patientsById,
  timeBlocks,
  businessHours,
  dayHref,
  renderTurno,
}: {
  monthStart: Date;
  appointments: AppointmentWithConsultation[];
  patientsById: Map<string, string>;
  timeBlocks: TimeBlock[];
  businessHours: BusinessHours[];
  dayHref: (day: Date) => string;
  renderTurno: (appointment: AppointmentWithConsultation, row: React.ReactNode) => React.ReactNode;
}) {
  const gridStart = getWeekStart(monthStart);
  const lastDay = addDays(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1), -1);
  const weeks = Math.round((addDays(getWeekStart(lastDay), 7).getTime() - gridStart.getTime()) / (7 * 86_400_000));
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));
  const todayKey = new Date().toDateString();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        <div className="grid min-w-[840px] grid-cols-7">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="sticky top-0 z-10 border-b border-l bg-card py-2 text-center text-sm font-medium first:border-l-0"
            >
              {weekday}
            </div>
          ))}

          {days.map((day) => {
            const inMonth = day.getMonth() === monthStart.getMonth();
            const isToday = day.toDateString() === todayKey;
            const turnos = appointments
              .filter((a) => isSameDay(a.startsAt, day))
              .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
            const dayStart = new Date(day);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = dayStart.getTime() + 86_400_000;
            const blocks = timeBlocks.filter(
              (b) => b.startsAt.getTime() < dayEnd && b.endsAt.getTime() > dayStart.getTime(),
            );
            // Closed all day (e.g. Sunday): the same hatch as the other views.
            const closedAllDay = closedRanges(businessHoursForWeekday(businessHours, day.getDay())).some(
              (r) => r.startMinutes === 0 && r.endMinutes === 24 * 60,
            );
            const hidden = turnos.length - MAX_PER_DAY;

            return (
              <div
                key={day.toISOString()}
                data-today={isToday}
                className={`flex min-h-32 flex-col gap-1 border-b border-l p-1.5 [&:nth-child(7n+8)]:border-l-0 ${
                  closedAllDay ? "hatch-closed" : ""
                } ${isToday ? "bg-primary/5" : ""} ${inMonth ? "" : "opacity-50"}`}
              >
                <Link
                  href={dayHref(day)}
                  aria-label={String(day.getDate())}
                  className={`flex size-7 items-center justify-center self-start rounded-full text-sm font-medium hover:bg-accent ${
                    isToday ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""
                  }`}
                >
                  {day.getDate()}
                </Link>

                {blocks.map((block) => (
                  <div key={block.id} className="min-w-0">
                    <TimeBlockBadge block={block} />
                  </div>
                ))}

                {turnos.slice(0, MAX_PER_DAY).map((appointment) => {
                  const patientName = appointment.patientId
                    ? (patientsById.get(appointment.patientId) ?? "Paciente")
                    : "Sin paciente";
                  return (
                    <div key={appointment.id} className="min-w-0">
                      {renderTurno(
                        appointment,
                        <button
                          type="button"
                          className={`w-full truncate rounded-sm border border-l-4 bg-card px-1.5 py-0.5 text-left text-xs hover:bg-accent ${STATUS_EDGE[appointment.status]} ${
                            appointment.status === "CANCELLED" ? "text-muted-foreground line-through" : ""
                          }`}
                        >
                          <span className="font-semibold tabular-nums">
                            {formatTime(appointment.startsAt)}
                          </span>{" "}
                          {patientName}
                        </button>,
                      )}
                    </div>
                  );
                })}

                {hidden > 0 && (
                  <Link
                    href={dayHref(day)}
                    className="px-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                  >
                    +{hidden} más
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium">Estados:</span>
        {LEGEND.map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${STATUS_DOT[status]}`} />
            {APPOINTMENT_STATUS_LABELS[status]}
          </span>
        ))}
      </div>
    </div>
  );
}
