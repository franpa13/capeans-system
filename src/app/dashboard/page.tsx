import { currentUser } from "@clerk/nextjs/server";
import { PageHeader } from "@/components/page-header";
import { DashboardSummary } from "@/features/dashboard/components/dashboard-summary";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getPatients } from "@/features/clinic/data/patients";
import { getConsultations } from "@/features/clinic/data/consultations";

export default async function DashboardPage() {
  const user = await currentUser();
  const clinic = await getCurrentClinic();
  const [patients, consultations] = clinic
    ? await Promise.all([getPatients(clinic.id), getConsultations(clinic.id)])
    : [[], []];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Hola, ${user?.fullName ?? ""}`}
        description="Este es el panel del consultorio. Las secciones se van a ir agregando en los próximos pasos."
      />

      <DashboardSummary
        patientCount={patients.length}
        consultationCount={consultations.length}
      />
    </div>
  );
}
