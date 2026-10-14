"use client";

import { useMemo, useState } from "react";
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
import { formatDate } from "@/features/clinic/lib/format";
import type { AppointmentWithConsultation } from "@/features/clinic/data/appointments";
import type { SupplyOption } from "@/features/consultations/components/supplies-used-field";

type PatientOption = { id: string; name: string };
type CompletedTurno = { patient: PatientOption; appointment: Appointment };

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
  // A solid, near-opaque fill read as too heavy against the grid — a
  // light tinted wash with a soft border (the same look CANCELLED/
  // COMPLETED already had) keeps it readable without dominating the page.
  CONFIRMED: "bg-primary/15 text-accent-foreground border-primary/30 dark:bg-primary/25 dark:border-primary/40",
  CANCELLED: "bg-muted text-muted-foreground border-border line-through opacity-60",
  COMPLETED: "bg-accent text-accent-foreground border-accent-foreground/30",
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle isDayView={isDayView} semanalHref={semanalHref} diarioHref={diarioHref} />
          <AppointmentStatusFilter value={estado} />
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" asChild>
              <Link href={`/dashboard/turnos?week=${prevWeek}&estado=${estado}`} aria-label="Semana anterior">
                <ChevronLeft />
              </Link>
            </Button>
            <span className="text-sm font-medium">
              Semana del {formatDate(toWeekParam(weekStart))} al {formatDate(toWeekParam(weekEnd))}
            </span>
            <Button variant="outline" size="icon" asChild>
              <Link href={`/dashboard/turnos?week=${nextWeek}&estado=${estado}`} aria-label="Semana siguiente">
                <ChevronRight />
              </Link>
            </Button>
          </div>

          {/* A text label inside the grid risked sitting right under an
          appointment that happens to start at that exact time — a legend
          here explains the two dashed lines once, so the grid itself only
          needs the color, never the words. */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className={`h-0 w-3 border-t-2 border-dashed ${BOUNDARY_COLORS["Hora inicio"].line}`}
              />
              Hora inicio
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`h-0 w-3 border-t-2 border-dashed ${BOUNDARY_COLORS["Hora fin"].line}`} />
              Hora fin
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

          {days.map((day) => {
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
                  />
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
                          className={`absolute left-1 right-1 z-1 overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-xs shadow-sm ${STATUS_STYLES[appointment.status]}`}
                        >
                          <div className="flex items-center gap-1 font-medium">
                            <ConsultaStatusIcon appointment={appointment} />
                            <span className="truncate">{patientName}</span>
                          </div>
                          {appointment.reason && (
                            <div className="truncate opacity-90">{appointment.reason}</div>
                          )}
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
