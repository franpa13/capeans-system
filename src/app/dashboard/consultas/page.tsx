import { PageHeader } from "@/components/page-header";
import { ConsultationsView } from "@/features/consultations/components/consultations-view";
import { NewConsultationDialog } from "@/features/consultations/components/new-consultation-dialog";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getConsultations } from "@/features/clinic/data/consultations";
import { getPatients } from "@/features/clinic/data/patients";

export default async function ConsultasPage() {
  const clinic = await getCurrentClinic();
  const [consultations, patients] = clinic
    ? await Promise.all([getConsultations(clinic.id), getPatients(clinic.id)])
    : [[], []];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Consultas/Tratamientos"
        description="Historial de todo lo realizado a los pacientes."
        action={<NewConsultationDialog patients={patients} />}
      />

      <ConsultationsView consultations={consultations} patients={patients} />
    </div>
  );
}
