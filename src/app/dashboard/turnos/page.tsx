import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { AppointmentsCalendar } from "@/features/appointments/components/appointments-calendar";
import { DailyAgenda } from "@/features/appointments/components/daily-agenda";
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

export default async function TurnosPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; view?: string; day?: string }>;
}) {
  const { week, view, day } = await searchParams;
  const isDayView = view === "day";
  const weekStart = getWeekStart(parseWeekParam(week));
  const weekEnd = addDays(weekStart, 7);

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
          ? getAppointments(clinic.id, { from: selectedDay, to: addDays(selectedDay, 1) })
          : getAppointments(clinic.id, { from: weekStart, to: weekEnd }),
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
              <Link href={`/dashboard/turnos?week=${weekParam}`}>Semanal</Link>
            </Button>
            <Button variant={isDayView ? "secondary" : "ghost"} size="sm" asChild>
              <Link
                href={`/dashboard/turnos?week=${weekParam}&view=day&day=${toWeekParam(selectedDay)}`}
              >
                Diario
              </Link>
            </Button>
          </div>
        }
      />
      {isDayView ? (
        <DailyAgenda
          day={selectedDay}
          appointments={appointments}
          patients={patients}
          businessHours={businessHours}
        />
      ) : (
        <AppointmentsCalendar
          weekStart={weekStart}
          appointments={appointments}
          patients={patients}
          businessHours={businessHours}
        />
      )}
    </div>
  );
}
