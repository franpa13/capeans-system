import { currentUser } from "@clerk/nextjs/server";
import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DashboardSummary } from "@/features/dashboard/components/dashboard-summary";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getPatients } from "@/features/clinic/data/patients";
import { getConsultations } from "@/features/clinic/data/consultations";
import { getAppointments } from "@/features/clinic/data/appointments";
import { addDays, getWeekStart } from "@/features/appointments/lib/week";

export default async function DashboardPage() {
  const user = await currentUser();
  const clinic = await getCurrentClinic();
  const weekStart = getWeekStart(new Date());
  const [patients, consultations, appointments] = clinic
    ? await Promise.all([
        getPatients(clinic.id),
        getConsultations(clinic.id),
        getAppointments(clinic.id, { from: weekStart, to: addDays(weekStart, 7) }),
      ])
    : [[], [], []];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Hola, ${user?.fullName ?? ""}`}
        description="Este es el panel del consultorio. Las secciones se van a ir agregando en los próximos pasos."
        icon={LayoutDashboard}
      />

      <DashboardSummary
        patientCount={patients.length}
        consultationCount={consultations.length}
        upcomingAppointmentCount={appointments.length}
      />
    </div>
  );
}
