"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ClipboardList, Plus, X } from "lucide-react";
import type { Appointment, BusinessHours } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AppointmentDialog } from "@/features/appointments/components/appointment-dialog";
import { AppointmentStatusFilter } from "@/features/appointments/components/appointment-status-filter";
import { ViewToggle } from "@/features/appointments/components/view-toggle";
import { StatusChip } from "@/features/appointments/components/status-chip";
import { NewConsultationDialog } from "@/features/consultations/components/new-consultation-dialog";
import {
  CONSULTA_STATUS_LABELS,
  ConsultaStatusIcon,
  consultaStatus,
} from "@/features/appointments/components/consulta-status";
import {
  addDays,
  formatDayLabel,
  getWeekDays,
  getWeekStart,
  isSameDay,
  toWeekParam,
} from "@/features/appointments/lib/week";
import { businessHoursForWeekday, closedRanges } from "@/features/appointments/lib/business-hours";
import { formatDate, formatTime } from "@/features/clinic/lib/format";
import type { AppointmentWithConsultation } from "@/features/clinic/data/appointments";
import type { SupplyOption } from "@/features/consultations/components/supplies-used-field";

type PatientOption = { id: string; name: string; phone?: string };
type CompletedTurno = { patient: PatientOption; appointment: Appointment };

// Tall enough for a 30-minute turno to show its time, name, state and
// motivo on two lines.
const HOUR_HEIGHT = 96; // px
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

const STATUS_STYLES: Record<Appointment["status"], string> = {
  // A solid, near-opaque fill read as too heavy against the grid — a
  // light tinted wash with a soft border (the same look CANCELLED/
  // COMPLETED already had) keeps it readable without dominating the page.
  CONFIRMED: "bg-primary/15 text-accent-foreground border-primary/30 dark:bg-primary/25 dark:border-primary/40",
  CANCELLED: "bg-muted text-muted-foreground border-border line-through opacity-60",
  COMPLETED: "bg-accent text-accent-foreground border-accent-foreground/30",
  NO_SHOW: "bg-destructive/10 text-destructive border-destructive/30 opacity-80",
};

export function AppointmentsCalendar({
  weekStart,
  appointments,
  patients,
  businessHours,
  estado,
  isDayView,
  semanalHref,
  diarioHref,
  insuranceOptions,
  treatmentOptions,
  treatmentPrices,
  supplyOptions,
  clinicName,
}: {
  weekStart: Date;
  appointments: AppointmentWithConsultation[];
  patients: PatientOption[];
  businessHours: BusinessHours[];
  estado: string;
  isDayView: boolean;
  semanalHref: string;
  diarioHref: string;
  insuranceOptions: string[];
  treatmentOptions: string[];
  treatmentPrices: Record<string, number>;
  supplyOptions: SupplyOption[];
  clinicName: string;
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

  // After marking a turno completed, offer to log the consulta for it —
  // not forced. Two separate pieces of state (rather than one, reused)
  // so accepting the offer can't race the AlertDialog's own close:
  // accepting sets consultationFor and clears completed in the same click
  // handler, instead of one dialog's close trying to infer whether the
  // other is about to open. Both carry the turno itself, so the consulta
  // gets linked to it and prefilled with its date and motivo.
  const [completed, setCompleted] = useState<CompletedTurno | null>(null);
  const [consultationFor, setConsultationFor] = useState<CompletedTurno | null>(null);

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
  const weekEnd = addDays(weekStart, 6);

  const closedByDay = days.map((day) =>
    closedRanges(businessHoursForWeekday(businessHours, day.getDay())),
  );
  // The earliest the clinic opens on any day of the week (a closed range
  // that starts at midnight ends at the opening time); 8:00 if it never opens.
  const firstOpening = Math.min(
    ...closedByDay.map((ranges) => {
      const morning = ranges.find((r) => r.startMinutes === 0);
      return morning ? (morning.endMinutes < 24 * 60 ? morning.endMinutes : Infinity) : 0;
    }),
  );
  const openingMinutes = Number.isFinite(firstOpening) ? firstOpening : 8 * 60;
  const todayKey = new Date().toDateString();
  const weekKey = weekStart.getTime();

  // Lands the grid on the opening hour instead of midnight (before paint,
  // so it doesn't visibly jump), the same way the Día view does.
  const scrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = Math.max(0, (openingMinutes / 60) * HOUR_HEIGHT - 8);
  }, [weekKey, openingMinutes]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle isDayView={isDayView} semanalHref={semanalHref} diarioHref={diarioHref} />
          <AppointmentStatusFilter value={estado} />
          <div className="flex items-center gap-1">
            <Button variant="outline" asChild>
              <Link href={`/dashboard/turnos?week=${prevWeek}&view=week&estado=${estado}`} aria-label="Semana anterior">
                <ChevronLeft />
                Anterior
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/dashboard/turnos?view=week&estado=${estado}`}>Hoy</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/dashboard/turnos?week=${nextWeek}&view=week&estado=${estado}`} aria-label="Semana siguiente">
                Siguiente
                <ChevronRight />
              </Link>
            </Button>
            <span className="ml-2 text-sm font-medium">
              Semana del {formatDate(toWeekParam(weekStart))} al {formatDate(toWeekParam(weekEnd))}
            </span>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined);
            // Today only if it actually falls inside the week being
            // viewed — otherwise this used to silently default to
            // "right now", which could land outside the visible week
            // entirely (and at whatever time happened to be on the
            // clock) if you'd navigated away from the current week.
            const today = new Date();
            const base = getWeekStart(today).getTime() === weekStart.getTime() ? today : weekStart;
            const start = new Date(base);
            start.setHours(9, 0, 0, 0);
            setNewStart(start);
            setDialogOpen(true);
          }}
        >
          <Plus />
          Nuevo turno
        </Button>
      </div>


      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto rounded-md border">
        <div className="grid grid-cols-[64px_repeat(7,minmax(150px,1fr))]">
          <div className="sticky top-0 z-10 border-b bg-card" />
          {days.map((day) => {
            const isToday = day.toDateString() === todayKey;
            const count = appointments.filter((a) => isSameDay(a.startsAt, day)).length;
            return (
              <div
                key={day.toISOString()}
                data-today={isToday}
                className={`sticky top-0 z-10 flex flex-col items-center border-b border-l px-2 py-1.5 ${
                  isToday
                    ? // Opaque on purpose: the header is sticky, and turnos
                      // scrolling under a see-through tint showed through it.
                      "bg-[color-mix(in_oklch,var(--primary)_15%,var(--card))] text-primary"
                    : "bg-card"
                }`}
              >
                <span className="text-xs text-muted-foreground capitalize">
                  {day.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "")}
                </span>
                <span className="text-xl leading-tight font-semibold">{day.getDate()}</span>
                <span className="text-[11px] text-muted-foreground">
                  {count} {count === 1 ? "turno" : "turnos"}
                </span>
              </div>
            );
          })}

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
            const isToday = day.toDateString() === todayKey;
            return (
              <div
                key={day.toISOString()}
                className={`relative border-l ${isToday ? "bg-primary/[0.04]" : ""}`}
                style={{ height: HOUR_HEIGHT * 24 }}
              >
                {/* Closed hours: shaded, and labeled when there's room. */}
                {closedByDay[dayIndex].map(({ startMinutes, endMinutes }) => {
                  const top = (startMinutes / 60) * HOUR_HEIGHT;
                  const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
                  return (
                    <div
                      key={startMinutes}
                      aria-hidden
                      className="hatch-closed pointer-events-none absolute right-0 left-0 flex items-center justify-center"
                      style={{ top, height }}
                    >
                      {endMinutes - startMinutes >= 60 && (
                        <span className="rounded-full border bg-card px-2.5 py-0.5 text-xs text-muted-foreground shadow-xs">
                          Cerrado
                        </span>
                      )}
                    </div>
                  );
                })}
                {HOURS.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    style={{ height: HOUR_HEIGHT, top: hour * HOUR_HEIGHT }}
                    className="absolute left-0 right-0 border-t hover:bg-accent/40"
                    onClick={() => openCreateAt(day, hour)}
                    aria-label={`Nuevo turno ${formatDayLabel(day)} ${hour}:00`}
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-border/50"
                      style={{ top: HOUR_HEIGHT / 2 }}
                    />
                  </button>
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
                  const status = consultaStatus(appointment);

                  return (
                    <Tooltip key={appointment.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(appointment);
                          }}
                          style={{ top, height }}
                          className={`absolute left-1 right-1 z-1 flex flex-col justify-start gap-0.5 overflow-hidden rounded-md border px-1.5 py-1 text-left text-xs shadow-sm ${STATUS_STYLES[appointment.status]}`}
                        >
                          <div className="flex items-center gap-1 text-sm font-semibold">
                            <ConsultaStatusIcon appointment={appointment} />
                            <span className="truncate">
                              <span className="tabular-nums">{formatTime(appointment.startsAt)}</span>{" "}
                              {patientName}
                            </span>
                          </div>
                          <div className="flex min-w-0 items-center gap-1.5">
                            <StatusChip status={appointment.status} />
                            {appointment.reason && (
                              <span className="truncate opacity-90">{appointment.reason}</span>
                            )}
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="flex-col items-start gap-0.5 text-left">
                        <p className="font-medium">{patientName}</p>
                        <p>{appointment.reason || "Sin motivo especificado"}</p>
                        {status && <p>{CONSULTA_STATUS_LABELS[status]}</p>}
                      </TooltipContent>
                    </Tooltip>
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
        insuranceOptions={insuranceOptions}
        clinicName={clinicName}
        onSaved={() => router.refresh()}
        onCompleted={(appointment) => {
          if (!appointment.patientId) return;
          setCompleted({
            patient: {
              id: appointment.patientId,
              name: patientsById.get(appointment.patientId) ?? "Paciente",
            },
            appointment,
          });
        }}
      />

      <AlertDialog open={!!completed} onOpenChange={(next) => !next && setCompleted(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turno completado</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Querés registrar qué se hizo en la consulta de {completed?.patient.name}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCompleted(null)}>
              <X />
              Ahora no
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConsultationFor(completed);
                setCompleted(null);
              }}
            >
              <ClipboardList />
              Registrar consulta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {consultationFor && (
        <NewConsultationDialog
          patients={patients}
          fixedPatientId={consultationFor.patient.id}
          fixedPatientName={consultationFor.patient.name}
          treatmentOptions={treatmentOptions}
          treatmentPrices={treatmentPrices}
          insuranceOptions={insuranceOptions}
          initialAppointment={consultationFor.appointment}
          supplyOptions={supplyOptions}
          open
          onOpenChange={(next) => {
            if (!next) setConsultationFor(null);
          }}
        />
      )}
    </div>
  );
}
