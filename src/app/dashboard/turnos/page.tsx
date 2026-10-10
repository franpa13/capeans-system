import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AppointmentsCalendar } from "@/features/appointments/components/appointments-calendar";
import { DailyAgenda } from "@/features/appointments/components/daily-agenda";
import { ALL_STATUSES, DEFAULT_STATUS } from "@/features/appointments/lib/status";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getAppointments } from "@/features/clinic/data/appointments";
import { getPatients } from "@/features/clinic/data/patients";
import { getBusinessHours } from "@/features/clinic/data/business-hours";
import { getClinicOptions } from "@/features/clinic/data/clinic-options";
import {
  addDays,
  getWeekStart,
  parseWeekParam,
  startOfDay,
  toWeekParam,
} from "@/features/appointments/lib/week";
import type { AppointmentStatus } from "@prisma/client";

export default async function TurnosPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; view?: string; day?: string; estado?: string }>;
}) {
  const { week, view, day, estado } = await searchParams;
  const isDayView = view === "day";
  const weekStart = getWeekStart(parseWeekParam(week));
  const weekEnd = addDays(weekStart, 7);

  // Cancelled turnos are hidden by default (a cancelled slot isn't
  // actually happening that day) — the estado filter lets that be
  // changed deliberately instead.
  const statusParam = estado ?? DEFAULT_STATUS;
  const statusFilter =
    statusParam === ALL_STATUSES ? undefined : (statusParam as AppointmentStatus);

  // Defaults the day view to today when today falls inside the week
  // already being viewed, otherwise to that week's Monday.
  const today = new Date();
  const selectedDay = day
    ? startOfDay(parseWeekParam(day))
    : getWeekStart(today).getTime() === weekStart.getTime()
      ? startOfDay(today)
      : weekStart;

  const clinic = await getCurrentClinic();
  const [appointments, patients, businessHours, insuranceOptionRows, treatmentOptionRows] = clinic
    ? await Promise.all([
        isDayView
          ? getAppointments(
              clinic.id,
              { from: selectedDay, to: addDays(selectedDay, 1) },
              statusFilter,
            )
          : getAppointments(clinic.id, { from: weekStart, to: weekEnd }, statusFilter),
        getPatients(clinic.id),
        getBusinessHours(clinic.id),
        getClinicOptions(clinic.id, "insurance"),
        getClinicOptions(clinic.id, "treatment"),
      ])
    : [[], [], [], [], []];
  const insuranceOptions = insuranceOptionRows.map((o) => o.label);
  const treatmentOptions = treatmentOptionRows.map((o) => o.label);

  const weekParam = toWeekParam(weekStart);
  const semanalHref = `/dashboard/turnos?week=${weekParam}&estado=${statusParam}`;
  const diarioHref = `/dashboard/turnos?week=${weekParam}&view=day&day=${toWeekParam(selectedDay)}&estado=${statusParam}`;

  return (
    // Capped to the viewport (minus the 56px header + its border and the
    // 24px top/bottom padding dashboard/layout.tsx's <main> applies) so
    // the calendar grid below is the thing that scrolls, not the page.
    <div className="flex h-[calc(100svh-105px)] min-w-0 flex-col gap-6">
      <PageHeader title="Turnos" description="Agenda semanal del consultorio." icon={CalendarDays} />
      {isDayView ? (
        <DailyAgenda
          day={selectedDay}
          appointments={appointments}
          patients={patients}
          businessHours={businessHours}
          estado={statusParam}
          isDayView={isDayView}
          semanalHref={semanalHref}
          diarioHref={diarioHref}
          insuranceOptions={insuranceOptions}
          treatmentOptions={treatmentOptions}
        />
      ) : (
        <AppointmentsCalendar
          weekStart={weekStart}
          appointments={appointments}
          patients={patients}
          businessHours={businessHours}
          estado={statusParam}
          isDayView={isDayView}
          semanalHref={semanalHref}
          diarioHref={diarioHref}
          insuranceOptions={insuranceOptions}
          treatmentOptions={treatmentOptions}
        />
      )}
    </div>
  );
}
