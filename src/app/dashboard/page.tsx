import { currentUser } from "@clerk/nextjs/server";
import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DashboardSummary } from "@/features/dashboard/components/dashboard-summary";
import { TodayPanel } from "@/features/dashboard/components/today-panel";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getPatients } from "@/features/clinic/data/patients";
import { getConsultations } from "@/features/clinic/data/consultations";
import { getAppointments } from "@/features/clinic/data/appointments";
import { getClinicOptions } from "@/features/clinic/data/clinic-options";
import { getSupplies } from "@/features/clinic/data/supplies";
import { addDays, getWeekStart, startOfDay } from "@/features/appointments/lib/week";
import { debtsByPatient, outstandingBalance } from "@/features/clinic/lib/billing";

export default async function DashboardPage() {
  const user = await currentUser();
  const clinic = await getCurrentClinic();
  const weekStart = getWeekStart(new Date());
  const now = new Date();
  const today = startOfDay(now);
  const [
    patients,
    consultations,
    weekAppointments,
    todayAppointments,
    reminderAppointments,
    insuranceOptionRows,
    treatmentOptionRows,
    supplies,
  ] = clinic
    ? await Promise.all([
        getPatients(clinic.id),
        getConsultations(clinic.id),
        getAppointments(clinic.id, { from: weekStart, to: addDays(weekStart, 7) }),
        getAppointments(clinic.id, { from: today, to: addDays(today, 1) }),
        // Everything still to come in the next 24 hours, across midnight.
        getAppointments(
          clinic.id,
          { from: now, to: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
          "CONFIRMED",
        ),
        getClinicOptions(clinic.id, "insurance"),
        getClinicOptions(clinic.id, "treatment"),
        getSupplies(clinic.id),
      ])
    : [[], [], [], [], [], [], [], []];
  // A cancelled turno isn't happening, so it's left off today's list.
  // Completed ones stay: that's where a forgotten consulta gets registered.
  const appointmentsToday = todayAppointments
    .filter((a) => a.status !== "CANCELLED")
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const pendingAmount = outstandingBalance(consultations);
  const patientNames = new Map(patients.map((p) => [p.id, p.name]));
  const debts = debtsByPatient(consultations).map((d) => ({
    ...d,
    name: patientNames.get(d.patientId) ?? "Paciente",
  }));
  const treatmentPrices = Object.fromEntries(
    treatmentOptionRows.filter((o) => o.price != null).map((o) => [o.label, o.price!]),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Hola, ${user?.fullName ?? ""}`}
        description="Resumen de tu consultorio."
        icon={LayoutDashboard}
      />

      <DashboardSummary
        patientCount={patients.length}
        consultationCount={consultations.length}
        upcomingAppointmentCount={weekAppointments.length}
        pendingAmount={pendingAmount}
      />

      <TodayPanel
        appointments={appointmentsToday}
        reminderAppointments={reminderAppointments}
        clinicName={clinic?.name ?? ""}
        patients={patients.map((p) => ({ id: p.id, name: p.name, phone: p.phone }))}
        debts={debts}
        supplies={supplies}
        insuranceOptions={insuranceOptionRows.map((o) => o.label)}
        treatmentOptions={treatmentOptionRows.map((o) => o.label)}
        treatmentPrices={treatmentPrices}
        supplyOptions={supplies.map((s) => ({ id: s.id, name: s.name, unit: s.unit }))}
      />
    </div>
  );
}
