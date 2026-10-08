"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Appointment, BusinessHours } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { AppointmentDialog } from "@/features/appointments/components/appointment-dialog";
import {
  addDays,
  formatDayLabel,
  getWeekDays,
  isSameDay,
  toWeekParam,
} from "@/features/appointments/lib/week";
import { businessHoursForWeekday, closedRanges } from "@/features/appointments/lib/business-hours";
import { formatDate } from "@/features/clinic/lib/format";

type PatientOption = { id: string; name: string };

const HOUR_HEIGHT = 48; // px
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

type Boundary = { minutes: number; label: "Hora inicio" | "Hora fin" };

const BOUNDARY_COLORS: Record<Boundary["label"], { line: string; text: string }> = {
  "Hora inicio": {
    line: "border-green-500 dark:border-green-400",
    text: "text-green-600 dark:text-green-400",
  },
  "Hora fin": {
    line: "border-red-500 dark:border-red-400",
    text: "text-red-600 dark:text-red-400",
  },
};

/** The open/close boundaries worth drawing a line at, each labeled by
 * which kind of transition it is — the start and end of the full day (0
 * and 1440) aren't real transitions, so they're excluded. A closed
 * range's end is when business hours start (open), and its start is
 * when they end (close) — see business-hours.ts's closedRanges. */
function boundaries(ranges: { startMinutes: number; endMinutes: number }[]): Boundary[] {
  const byMinute = new Map<number, Boundary["label"]>();
  for (const range of ranges) {
    if (range.endMinutes < 24 * 60) byMinute.set(range.endMinutes, "Hora inicio");
    if (range.startMinutes > 0) byMinute.set(range.startMinutes, "Hora fin");
  }
  return [...byMinute.entries()].map(([minutes, label]) => ({ minutes, label }));
}

const STATUS_STYLES: Record<Appointment["status"], string> = {
  CONFIRMED: "bg-primary/90 text-primary-foreground border-primary",
  CANCELLED: "bg-muted text-muted-foreground border-border line-through opacity-60",
  COMPLETED: "bg-accent text-accent-foreground border-accent-foreground/30",
};

export function AppointmentsCalendar({
  weekStart,
  appointments,
  patients,
  businessHours,
}: {
  weekStart: Date;
  appointments: Appointment[];
  patients: PatientOption[];
  businessHours: BusinessHours[];
}) {
  const router = useRouter();
  const days = getWeekDays(weekStart);
  const patientsById = useMemo(
    () => new Map(patients.map((p) => [p.id, p.name])),
    [patients],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | undefined>(undefined);
  const [newStart, setNewStart] = useState<Date | undefined>(undefined);

  function openCreateAt(day: Date, hour: number) {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    setEditing(undefined);
    setNewStart(start);
    setDialogOpen(true);
  }

  function openEdit(appointment: Appointment) {
    setEditing(appointment);
    setNewStart(undefined);
    setDialogOpen(true);
  }

  const prevWeek = toWeekParam(addDays(weekStart, -7));
  const nextWeek = toWeekParam(addDays(weekStart, 7));
  const todayWeek = toWeekParam(new Date());
  const weekEnd = addDays(weekStart, 6);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" asChild>
            <Link href={`/dashboard/turnos?week=${prevWeek}`}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button variant="outline" size="icon" asChild>
            <Link href={`/dashboard/turnos?week=${nextWeek}`}>
              <ChevronRight />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/dashboard/turnos?week=${todayWeek}`}>Hoy</Link>
          </Button>
          <span className="ml-2 text-sm font-medium">
            Semana del {formatDate(toWeekParam(weekStart))} al {formatDate(toWeekParam(weekEnd))}
          </span>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined);
            setNewStart(new Date());
            setDialogOpen(true);
          }}
        >
          <Plus />
          Nuevo turno
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        <div className="grid grid-cols-[64px_repeat(7,minmax(140px,1fr))]">
          <div className="sticky top-0 z-10 border-b bg-card" />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="sticky top-0 z-10 border-b border-l bg-card px-2 py-2 text-center text-sm font-medium"
            >
              {formatDayLabel(day)}
            </div>
          ))}

          <div className="border-r">
            {HOURS.map((hour) => (
              <div
                key={hour}
                style={{ height: HOUR_HEIGHT }}
                className="border-t px-1 text-right text-xs text-muted-foreground"
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {days.map((day, dayIndex) => {
            const dayAppointments = appointments.filter((a) => isSameDay(a.startsAt, day));
            const ranges = closedRanges(businessHoursForWeekday(businessHours, day.getDay()));
            return (
              <div
                key={day.toISOString()}
                className="relative border-l"
                style={{ height: HOUR_HEIGHT * 24 }}
              >
                {boundaries(ranges).map(({ minutes, label }) => (
                  <div
                    key={minutes}
                    aria-hidden
                    className={`pointer-events-none absolute left-0 right-0 z-1 border-t-2 border-dashed ${BOUNDARY_COLORS[label].line}`}
                    style={{ top: (minutes / 60) * HOUR_HEIGHT }}
                  >
                    {/* Only the leftmost day's column carries the text —
                        repeating it in all 7 columns was redundant, the
                        dashed line alone marks the boundary elsewhere. */}
                    {dayIndex === 0 && (
                      <span
                        className={`absolute left-1 -translate-y-1/2 rounded-sm bg-background px-1 text-[10px] leading-tight font-medium whitespace-nowrap ${BOUNDARY_COLORS[label].text}`}
                      >
                        {label}
                      </span>
                    )}
                  </div>
                ))}

                {HOURS.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    style={{ height: HOUR_HEIGHT, top: hour * HOUR_HEIGHT }}
                    className="absolute left-0 right-0 border-t hover:bg-accent/40"
                    onClick={() => openCreateAt(day, hour)}
                    aria-label={`Nuevo turno ${formatDayLabel(day)} ${hour}:00`}
                  />
                ))}

                {dayAppointments.map((appointment) => {
                  const top = (minutesFromMidnight(appointment.startsAt) / 60) * HOUR_HEIGHT;
                  const height = Math.max(
                    (appointment.durationMinutes / 60) * HOUR_HEIGHT,
                    20,
                  );
                  const patientName = appointment.patientId
                    ? (patientsById.get(appointment.patientId) ?? "Paciente")
                    : "Sin paciente";

                  return (
                    <button
                      key={appointment.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(appointment);
                      }}
                      style={{ top, height }}
                      className={`absolute left-1 right-1 z-1 overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-xs shadow-sm ${STATUS_STYLES[appointment.status]}`}
                    >
                      <div className="truncate font-medium">{patientName}</div>
                      {appointment.reason && (
                        <div className="truncate opacity-90">{appointment.reason}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <AppointmentDialog
        key={editing?.id ?? newStart?.getTime() ?? "closed"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        patients={patients}
        appointment={editing}
        initialStart={newStart}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
