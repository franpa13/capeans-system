"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Appointment } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { AppointmentDialog } from "@/features/appointments/components/appointment-dialog";
import {
  addDays,
  formatDayLabel,
  getWeekDays,
  isSameDay,
  toWeekParam,
} from "@/features/appointments/lib/week";

type PatientOption = { id: string; name: string };

const HOUR_HEIGHT = 48; // px
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
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
}: {
  weekStart: Date;
  appointments: Appointment[];
  patients: PatientOption[];
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

  return (
    <div className="flex flex-col gap-3">
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

      <div className="overflow-auto rounded-md border">
        <div className="grid grid-cols-[64px_repeat(6,minmax(140px,1fr))]">
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

          {days.map((day) => {
            const dayAppointments = appointments.filter((a) => isSameDay(a.startsAt, day));
            return (
              <div
                key={day.toISOString()}
                className="relative border-l"
                style={{ height: HOUR_HEIGHT * 24 }}
              >
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
