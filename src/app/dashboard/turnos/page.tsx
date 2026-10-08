import { PageHeader } from "@/components/page-header";
import { AppointmentsCalendar } from "@/features/appointments/components/appointments-calendar";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getAppointments } from "@/features/clinic/data/appointments";
import { getPatients } from "@/features/clinic/data/patients";
import { addDays, getWeekStart, parseWeekParam } from "@/features/appointments/lib/week";

export default async function TurnosPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const weekStart = getWeekStart(parseWeekParam(week));
  const weekEnd = addDays(weekStart, 7);

  const clinic = await getCurrentClinic();
  const [appointments, patients] = clinic
    ? await Promise.all([
        getAppointments(clinic.id, { from: weekStart, to: weekEnd }),
        getPatients(clinic.id),
      ])
    : [[], []];

  return (
    // Capped to the viewport (minus the 56px header + its border and the
    // 24px top/bottom padding dashboard/layout.tsx's <main> applies) so
    // the calendar grid below is the thing that scrolls, not the page.
    <div className="flex h-[calc(100svh-105px)] flex-col gap-6">
      <PageHeader
        title="Turnos"
        description="Agenda semanal del consultorio."
      />
      <AppointmentsCalendar
        weekStart={weekStart}
        appointments={appointments}
        patients={patients}
      />
    </div>
  );
}
