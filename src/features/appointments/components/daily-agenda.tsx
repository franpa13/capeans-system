"use client";

import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { ViewAppointmentDialog } from "@/features/appointments/components/view-appointment-dialog";
import { AppointmentStatusFilter } from "@/features/appointments/components/appointment-status-filter";
import { ViewToggle } from "@/features/appointments/components/view-toggle";
import { NewConsultationDialog } from "@/features/consultations/components/new-consultation-dialog";
import { addDays, formatDayLabel, getWeekStart, toWeekParam } from "@/features/appointments/lib/week";
import { businessHoursForWeekday, closedRanges } from "@/features/appointments/lib/business-hours";

type PatientOption = { id: string; name: string };

const HOUR_WIDTH = 80; // px
const ROW_HEIGHT = 56; // px
const LABEL_WIDTH = 180; // px
// Taller than the hour row alone so a "Hora inicio"/"Hora fin" boundary
// label has its own space underneath, instead of overlapping the hour text.
const HEADER_HEIGHT = 52; // px
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const TIMELINE_WIDTH = HOUR_WIDTH * 24;

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

/** The day view: hours on the X axis, one row per appointment (not per
 * patient — a patient with two appointments that day gets two rows) on
 * the Y axis, each rendered as a horizontal bar positioned by start time
 * and duration. Complements the weekly grid, which has days on the X axis
 * and hours on the Y axis. */
export function DailyAgenda({
  day,
  appointments,
  patients,
  businessHours,
  estado,
  isDayView,
  semanalHref,
  diarioHref,
  insuranceOptions,
  treatmentOptions,
}: {
  day: Date;
  appointments: Appointment[];
  patients: PatientOption[];
  businessHours: BusinessHours[];
  estado: string;
  isDayView: boolean;
  semanalHref: string;
  diarioHref: string;
  insuranceOptions: string[];
  treatmentOptions: string[];
}) {
  const router = useRouter();
  const patientsById = useMemo(
    () => new Map(patients.map((p) => [p.id, p.name])),
    [patients],
  );
  const sorted = useMemo(
    () => [...appointments].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    [appointments],
  );
  const ranges = closedRanges(businessHoursForWeekday(businessHours, day.getDay()));
  const hourBoundaries = boundaries(ranges);
  const openMinutes = hourBoundaries.find((b) => b.label === "Hora inicio")?.minutes;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | undefined>(undefined);
  const [newStart, setNewStart] = useState<Date | undefined>(undefined);
  const [viewing, setViewing] = useState<Appointment | null>(null);

  // After marking a turno completed, offer to log the consulta for it —
  // see appointments-calendar.tsx for why this is two separate pieces of
  // state instead of one reused across both dialogs.
  const [completedPatient, setCompletedPatient] = useState<PatientOption | null>(null);
  const [consultationPatient, setConsultationPatient] = useState<PatientOption | null>(null);

  // Lands the view on the clinic's opening time instead of midnight — a
  // day with few/no turnos before "Hora inicio" would otherwise open on
  // several empty hours the dentist has to scroll past every time.
  // useLayoutEffect (not useEffect) so the jump happens before paint,
  // not as a visible scroll after the day's already rendered at 00:00.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dayTime = day.getTime();
  useLayoutEffect(() => {
    if (openMinutes === undefined || !scrollContainerRef.current) return;
    scrollContainerRef.current.scrollLeft = (openMinutes / 60) * HOUR_WIDTH;
  }, [dayTime, openMinutes]);

  function openCreate() {
    const start = new Date(day);
    start.setHours(9, 0, 0, 0);
    setEditing(undefined);
    setNewStart(start);
    setDialogOpen(true);
  }

  function openView(appointment: Appointment) {
    setViewing(appointment);
  }

  function openEdit(appointment: Appointment) {
    setViewing(null);
    setEditing(appointment);
    setNewStart(undefined);
    setDialogOpen(true);
  }

  function hrefForDay(target: Date) {
    const targetWeek = toWeekParam(getWeekStart(target));
    return `/dashboard/turnos?week=${targetWeek}&view=day&day=${toWeekParam(target)}&estado=${estado}`;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle isDayView={isDayView} semanalHref={semanalHref} diarioHref={diarioHref} />
          <AppointmentStatusFilter value={estado} />
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" asChild>
              <Link href={hrefForDay(addDays(day, -1))} aria-label="Día anterior">
                <ChevronLeft />
              </Link>
            </Button>
            <Button variant="outline" size="icon" asChild>
              <Link href={hrefForDay(addDays(day, 1))} aria-label="Día siguiente">
                <ChevronRight />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={hrefForDay(new Date())}>Hoy</Link>
            </Button>
            <span className="ml-2 text-sm font-medium">{formatDayLabel(day)}</span>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          Nuevo turno
        </Button>
      </div>

      <div ref={scrollContainerRef} className="min-h-0 min-w-0 flex-1 overflow-auto rounded-md border">
        <div
          className="grid"
          style={{ gridTemplateColumns: `${LABEL_WIDTH}px ${TIMELINE_WIDTH}px` }}
        >
          <div className="sticky top-0 left-0 z-20 border-b bg-card" />
          <div
            className="sticky top-0 z-10 bg-card"
            style={{ height: HEADER_HEIGHT, width: TIMELINE_WIDTH }}
          >
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute border-b border-l px-1 text-xs text-muted-foreground"
                style={{ left: hour * HOUR_WIDTH, width: HOUR_WIDTH, height: 24 }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
            {hourBoundaries.map(({ minutes, label }) => (
              <div
                key={minutes}
                aria-hidden
                className={`pointer-events-none absolute top-0 bottom-0 z-1 border-l-2 border-dashed ${BOUNDARY_COLORS[label].line}`}
                style={{ left: (minutes / 60) * HOUR_WIDTH }}
              >
                <span
                  className={`absolute left-1 rounded-sm text-[10px] leading-tight font-medium whitespace-nowrap ${BOUNDARY_COLORS[label].text}`}
                  style={{ top: 24 }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          {sorted.length === 0 ? (
            <div className="col-span-2 flex h-32 items-center justify-center text-sm text-muted-foreground">
              No hay turnos para este día.
            </div>
          ) : (
            sorted.map((appointment) => {
              const patientName = appointment.patientId
                ? (patientsById.get(appointment.patientId) ?? "Paciente")
                : "Sin paciente";
              const left = (minutesFromMidnight(appointment.startsAt) / 60) * HOUR_WIDTH;
              const width = Math.max(
                (appointment.durationMinutes / 60) * HOUR_WIDTH,
                40,
              );

              return (
                <Fragment key={appointment.id}>
                  <div
                    className="sticky left-0 z-10 flex items-center border-t border-r bg-card px-2 text-sm font-medium"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <span className="truncate">{patientName}</span>
                  </div>
                  <div
                    className="relative border-t"
                    style={{ height: ROW_HEIGHT, width: TIMELINE_WIDTH }}
                  >
                    {hourBoundaries.map(({ minutes, label }) => (
                      <div
                        key={minutes}
                        aria-hidden
                        className={`pointer-events-none absolute top-0 bottom-0 z-1 border-l-2 border-dashed ${BOUNDARY_COLORS[label].line}`}
                        style={{ left: (minutes / 60) * HOUR_WIDTH }}
                      />
                    ))}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => openView(appointment)}
                          style={{ left, width, top: 6, height: ROW_HEIGHT - 12 }}
                          className={`absolute z-1 overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-xs shadow-sm ${STATUS_STYLES[appointment.status]}`}
                        >
                          <div className="truncate font-medium">
                            {String(appointment.startsAt.getHours()).padStart(2, "0")}:
                            {String(appointment.startsAt.getMinutes()).padStart(2, "0")}
                          </div>
                          {appointment.reason && (
                            <div className="truncate opacity-90">{appointment.reason}</div>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="flex-col items-start gap-0.5 text-left">
                        <p className="font-medium">{patientName}</p>
                        <p>{appointment.reason || "Sin motivo especificado"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </Fragment>
              );
            })
          )}
        </div>
      </div>

      {viewing && (
        <ViewAppointmentDialog
          key={`view-${viewing.id}`}
          appointment={viewing}
          patientName={
            viewing.patientId
              ? (patientsById.get(viewing.patientId) ?? "Paciente")
              : "Sin paciente"
          }
          open
          onOpenChange={(next) => {
            if (!next) setViewing(null);
          }}
          onEdit={() => openEdit(viewing)}
        />
      )}

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
          setCompletedPatient({
            id: appointment.patientId,
            name: patientsById.get(appointment.patientId) ?? "Paciente",
          });
        }}
      />

      <AlertDialog
        open={!!completedPatient}
        onOpenChange={(next) => !next && setCompletedPatient(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turno completado</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Querés registrar qué se hizo en la consulta de {completedPatient?.name}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCompletedPatient(null)}>
              <X />
              Ahora no
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConsultationPatient(completedPatient);
                setCompletedPatient(null);
              }}
            >
              <ClipboardList />
              Registrar consulta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {consultationPatient && (
        <NewConsultationDialog
          patients={patients}
          fixedPatientId={consultationPatient.id}
          fixedPatientName={consultationPatient.name}
          treatmentOptions={treatmentOptions}
          insuranceOptions={insuranceOptions}
          open={!!consultationPatient}
          onOpenChange={(next) => {
            if (!next) setConsultationPatient(null);
          }}
        />
      )}
    </div>
  );
}
