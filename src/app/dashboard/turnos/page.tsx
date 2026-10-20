import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AppointmentsCalendar } from "@/features/appointments/components/appointments-calendar";
import { DailyAgenda } from "@/features/appointments/components/daily-agenda";
import { ACTIVE_STATUSES, ALL_STATUSES, DEFAULT_STATUS } from "@/features/appointments/lib/status";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getAppointments } from "@/features/clinic/data/appointments";
import { getPatients } from "@/features/clinic/data/patients";
import { getBusinessHours } from "@/features/clinic/data/business-hours";
import { getClinicOptions } from "@/features/clinic/data/clinic-options";
import { getSupplies } from "@/features/clinic/data/supplies";
import { getTimeBlocks } from "@/features/clinic/data/time-blocks";
import {
  addDays,
  getWeekStart,
  parseWeekParam,
  startOfDay,
  toWeekParam,
} from "@/features/appointments/lib/week";
import type { AppointmentStatus } from "@prisma/client";
import { addMonths, parseMonthParam, toMonthParam } from "@/features/clinic/lib/month";

export default async function TurnosPage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string;
    view?: string;
    day?: string;
    mes?: string;
    estado?: string;
  }>;
}) {
  const { week, view, day, mes, estado } = await searchParams;
  // Día is the default — the dentist mostly wants today's agenda; the week
  // is one tap away (and keeps view=week while navigating weeks).
  const agendaView =
    view === "week" || view === "list" || view === "month" ? view : "day";
  const isDayView = agendaView === "day";
  const weekStart = getWeekStart(parseWeekParam(week));
  const weekEnd = addDays(weekStart, 7);

  // Cancelled turnos are hidden by default (a cancelled slot isn't
  // actually happening that day) — the estado filter lets that be
  // changed deliberately instead.
  const statusParam = estado ?? DEFAULT_STATUS;
  const statusFilter =
    statusParam === ALL_STATUSES
      ? undefined
      : (statusParam as AppointmentStatus | typeof ACTIVE_STATUSES);

  // Defaults the day view to today when today falls inside the week
  // already being viewed, otherwise to that week's Monday.
  const today = new Date();
  const selectedDay = day
    ? startOfDay(parseWeekParam(day))
    : getWeekStart(today).getTime() === weekStart.getTime()
      ? startOfDay(today)
      : weekStart;

  // Mes: the month named by ?mes= (or the one being looked at), drawn as
  // whole Mon–Sun weeks — so its range starts and ends on week bounds.
  const monthStart =
    agendaView === "month"
      ? parseMonthParam(mes)
      : new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1);
  const monthGrid = {
    from: getWeekStart(monthStart),
    to: addDays(getWeekStart(addDays(addMonths(monthStart, 1), -1)), 7),
  };

  const clinic = await getCurrentClinic();
  const range = isDayView
    ? { from: selectedDay, to: addDays(selectedDay, 1) }
    : agendaView === "month"
      ? monthGrid
      : { from: weekStart, to: weekEnd };
  const timeBlocks = clinic ? await getTimeBlocks(clinic.id, range) : [];
  const [appointments, patients, businessHours, insuranceOptionRows, treatmentOptionRows, supplies] = clinic
    ? await Promise.all([
        getAppointments(clinic.id, range, statusFilter),
        getPatients(clinic.id),
        getBusinessHours(clinic.id),
        getClinicOptions(clinic.id, "insurance"),
        getClinicOptions(clinic.id, "treatment"),
        getSupplies(clinic.id),
      ])
    : [[], [], [], [], [], []];
  const supplyOptions = supplies.map((s) => ({ id: s.id, name: s.name, unit: s.unit }));
  const insuranceOptions = insuranceOptionRows.map((o) => o.label);
  const treatmentOptions = treatmentOptionRows.map((o) => o.label);
  const treatmentPrices = Object.fromEntries(
    treatmentOptionRows.filter((o) => o.price != null).map((o) => [o.label, o.price!]),
  );

  const weekParam = toWeekParam(weekStart);
  const semanalHref = `/dashboard/turnos?week=${weekParam}&view=week&estado=${statusParam}`;
  const diarioHref = `/dashboard/turnos?week=${weekParam}&view=day&day=${toWeekParam(selectedDay)}&estado=${statusParam}`;
  const listaHref = `/dashboard/turnos?week=${weekParam}&view=list&estado=${statusParam}`;
  const mesHref = `/dashboard/turnos?view=month&mes=${toMonthParam(monthStart)}&estado=${statusParam}`;
  const viewHrefs = { diarioHref, semanalHref, mesHref, listaHref };

  return (
    // Capped to the viewport (minus the 56px header + its border and the
    // 24px top/bottom padding dashboard/layout.tsx's <main> applies) so
    // the calendar grid below is the thing that scrolls, not the page.
    <div className="flex h-[calc(100svh-105px)] min-w-0  flex-col gap-6">
      <PageHeader
        title="Turnos"
        description={
          agendaView === "day"
            ? "Agenda diaria del consultorio."
            : agendaView === "list"
              ? "Los turnos de la semana, en lista."
              : agendaView === "month"
              ? "Agenda mensual del consultorio."
              : "Agenda semanal del consultorio."
        }
        icon={CalendarDays}
      />
      {isDayView ? (
        <DailyAgenda
          day={selectedDay}
          appointments={appointments}
          patients={patients}
          businessHours={businessHours}
          estado={statusParam}
          view={agendaView}
          viewHrefs={viewHrefs}
          insuranceOptions={insuranceOptions}
          treatmentOptions={treatmentOptions}
          treatmentPrices={treatmentPrices}
          supplyOptions={supplyOptions}
          clinicName={clinic?.name ?? ""}
          timeBlocks={timeBlocks}
        />
      ) : (
        <AppointmentsCalendar
          weekStart={weekStart}
          monthStart={monthStart}
          appointments={appointments}
          patients={patients}
          businessHours={businessHours}
          estado={statusParam}
          view={agendaView}
          viewHrefs={viewHrefs}
          insuranceOptions={insuranceOptions}
          treatmentOptions={treatmentOptions}
          treatmentPrices={treatmentPrices}
          supplyOptions={supplyOptions}
          clinicName={clinic?.name ?? ""}
          timeBlocks={timeBlocks}
        />
      )}
    </div>
  );
}
