"use client";

import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ClipboardList, Plus, X } from "lucide-react";
import type { Appointment, BusinessHours, TimeBlock } from "@prisma/client";

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
import { ViewToggle, type AgendaView } from "@/features/appointments/components/view-toggle";
import { StatusChip } from "@/features/appointments/components/status-chip";
import { BlockTimeDialog } from "@/features/appointments/components/block-time-dialog";
import { TimeBlockBadge } from "@/features/appointments/components/time-block-badge";
import { NewConsultationDialog } from "@/features/consultations/components/new-consultation-dialog";
import {
  CONSULTA_STATUS_LABELS,
  ConsultaStatusIcon,
  consultaStatus,
} from "@/features/appointments/components/consulta-status";
import { addDays, formatDayLabel, getWeekStart, toWeekParam } from "@/features/appointments/lib/week";
import { businessHoursForWeekday, closedRanges } from "@/features/appointments/lib/business-hours";
import type { AppointmentWithConsultation } from "@/features/clinic/data/appointments";
import type { SupplyOption } from "@/features/consultations/components/supplies-used-field";

type PatientOption = { id: string; name: string; phone?: string };
type CompletedTurno = { patient: PatientOption; appointment: Appointment };

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

const STATUS_STYLES: Record<Appointment["status"], string> = {
  // A solid, near-opaque fill read as too heavy against the grid — a
  // light tinted wash with a soft border (the same look CANCELLED/
  // COMPLETED already had) keeps it readable without dominating the page.
  // Opaque tints (mixed with the card color): blocked periods and the
  // closed-hours hatch behind a turno must not show through its text.
  CONFIRMED:
    "bg-[color-mix(in_oklch,var(--primary)_15%,var(--card))] text-accent-foreground border-primary/30 dark:bg-[color-mix(in_oklch,var(--primary)_25%,var(--card))] dark:border-primary/40",
  CANCELLED: "bg-muted text-muted-foreground border-border line-through opacity-60",
  COMPLETED: "bg-accent text-accent-foreground border-accent-foreground/30",
  NO_SHOW:
    "bg-[color-mix(in_oklch,var(--destructive)_12%,var(--card))] text-destructive border-destructive/30",
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
  view,
  viewHrefs,
  insuranceOptions,
  treatmentOptions,
  treatmentPrices,
  supplyOptions,
  clinicName,
  timeBlocks,
}: {
  day: Date;
  appointments: AppointmentWithConsultation[];
  patients: PatientOption[];
  businessHours: BusinessHours[];
  estado: string;
  view: AgendaView;
  viewHrefs: { diarioHref: string; semanalHref: string; listaHref: string };
  insuranceOptions: string[];
  treatmentOptions: string[];
  treatmentPrices: Record<string, number>;
  supplyOptions: SupplyOption[];
  clinicName: string;
  timeBlocks: TimeBlock[];
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
  // A closed range starting at midnight ends when the clinic opens.
  const morning = ranges.find((r) => r.startMinutes === 0);
  const openMinutes = morning && morning.endMinutes < 24 * 60 ? morning.endMinutes : undefined;

  // Blocked periods (vacaciones, feriado…) clipped to this day, as x offsets.
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayBlocks = timeBlocks.flatMap((block) => {
    const start = Math.max(block.startsAt.getTime(), dayStart.getTime());
    const end = Math.min(block.endsAt.getTime(), dayStart.getTime() + 24 * 3_600_000);
    if (end <= start) return [];
    return [
      {
        block,
        left: ((start - dayStart.getTime()) / 3_600_000) * HOUR_WIDTH,
        width: ((end - start) / 3_600_000) * HOUR_WIDTH,
      },
    ];
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | undefined>(undefined);
  const [newStart, setNewStart] = useState<Date | undefined>(undefined);
  const [viewing, setViewing] = useState<Appointment | null>(null);

  // After marking a turno completed, offer to log the consulta for it —
  // see appointments-calendar.tsx for why this is two separate pieces of
  // state instead of one reused across both dialogs.
  const [completed, setCompleted] = useState<CompletedTurno | null>(null);
  const [consultationFor, setConsultationFor] = useState<CompletedTurno | null>(null);

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
          <ViewToggle view={view} {...viewHrefs} />
          <AppointmentStatusFilter value={estado} />
          <div className="flex items-center gap-1">
            <Button variant="outline" asChild>
              <Link href={hrefForDay(addDays(day, -1))} aria-label="Día anterior">
                <ChevronLeft />
                Anterior
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={hrefForDay(new Date())}>Hoy</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={hrefForDay(addDays(day, 1))} aria-label="Día siguiente">
                Siguiente
                <ChevronRight />
              </Link>
            </Button>
            <span className="ml-2 text-sm font-medium">{formatDayLabel(day)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <BlockTimeDialog defaultDay={day} />
          <Button onClick={openCreate}>
            <Plus />
            Nuevo turno
          </Button>
        </div>
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
{ranges.map(({ startMinutes, endMinutes }) => (
              <div
                key={startMinutes}
                aria-hidden
                className="hatch-closed pointer-events-none absolute bottom-0 flex items-center justify-center"
                style={{
                  top: 24,
                  left: (startMinutes / 60) * HOUR_WIDTH,
                  width: ((endMinutes - startMinutes) / 60) * HOUR_WIDTH,
                }}
              >
                {endMinutes - startMinutes >= 120 && (
                  <span className="text-[11px] text-muted-foreground">Cerrado</span>
                )}
              </div>
            ))}
            {dayBlocks.map(({ block, left, width }) => (
              <div
                key={block.id}
                className="pointer-events-none absolute bottom-0 z-1 flex items-center justify-start border-x border-amber-500/40 bg-amber-500/10 px-2"
                style={{ top: 24, left, width }}
              >
                <TimeBlockBadge block={block} />
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
              const status = consultaStatus(appointment);

              return (
                <Fragment key={appointment.id}>
                  <div
                    className="sticky left-0 z-10 flex flex-col items-start justify-center gap-0.5 border-t border-r bg-card px-2 text-sm font-medium"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <span className="max-w-full truncate">{patientName}</span>
                    <StatusChip status={appointment.status} />
                  </div>
                  <div
                    className="relative border-t"
                    style={{ height: ROW_HEIGHT, width: TIMELINE_WIDTH }}
                  >
                    {ranges.map(({ startMinutes, endMinutes }) => (
                      <div
                        key={startMinutes}
                        aria-hidden
                        className="hatch-closed pointer-events-none absolute top-0 bottom-0"
                        style={{
                          left: (startMinutes / 60) * HOUR_WIDTH,
                          width: ((endMinutes - startMinutes) / 60) * HOUR_WIDTH,
                        }}
                      />
                    ))}
                    {dayBlocks.map(({ block, left, width }) => (
                      <div
                        key={block.id}
                        aria-hidden
                        className="pointer-events-none absolute top-0 bottom-0 border-x border-amber-500/40 bg-amber-500/10"
                        style={{ left, width }}
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
                          <div className="flex items-center gap-1 font-medium">
                            <ConsultaStatusIcon appointment={appointment} />
                            <span className="truncate">
                              {String(appointment.startsAt.getHours()).padStart(2, "0")}:
                              {String(appointment.startsAt.getMinutes()).padStart(2, "0")}
                            </span>
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
          patientPhone={patients.find((p) => p.id === viewing.patientId)?.phone}
          clinicName={clinicName}
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
