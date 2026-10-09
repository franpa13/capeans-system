import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { AppointmentsCalendar } from "@/features/appointments/components/appointments-calendar";
import { DailyAgenda } from "@/features/appointments/components/daily-agenda";
import { AppointmentStatusFilter } from "@/features/appointments/components/appointment-status-filter";
import { ALL_STATUSES, DEFAULT_STATUS } from "@/features/appointments/lib/status";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getAppointments } from "@/features/clinic/data/appointments";
import { getPatients } from "@/features/clinic/data/patients";
import { getBusinessHours } from "@/features/clinic/data/business-hours";
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
  const [appointments, patients, businessHours] = clinic
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
      ])
    : [[], [], []];

  const weekParam = toWeekParam(weekStart);

  return (
    // Capped to the viewport (minus the 56px header + its border and the
    // 24px top/bottom padding dashboard/layout.tsx's <main> applies) so
    // the calendar grid below is the thing that scrolls, not the page.
    <div className="flex h-[calc(100svh-105px)] min-w-0 flex-col gap-6">
      <PageHeader
        title="Turnos"
        description="Agenda semanal del consultorio."
        action={
          <div className="flex gap-1 rounded-md border p-1">
            <Button variant={isDayView ? "ghost" : "secondary"} size="sm" asChild>
              <Link href={`/dashboard/turnos?week=${weekParam}&estado=${statusParam}`}>
                Semanal
              </Link>
            </Button>
            <Button variant={isDayView ? "secondary" : "ghost"} size="sm" asChild>
              <Link
                href={`/dashboard/turnos?week=${weekParam}&view=day&day=${toWeekParam(selectedDay)}&estado=${statusParam}`}
              >
                Diario
              </Link>
            </Button>
          </div>
        }
      />
      <AppointmentStatusFilter value={statusParam} />
      {isDayView ? (
        <DailyAgenda
          day={selectedDay}
          appointments={appointments}
          patients={patients}
          businessHours={businessHours}
          estado={statusParam}
        />
      ) : (
        <AppointmentsCalendar
          weekStart={weekStart}
          appointments={appointments}
          patients={patients}
          businessHours={businessHours}
          estado={statusParam}
        />
      )}
    </div>
  );
}
