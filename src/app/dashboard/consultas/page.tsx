import { PageHeader } from "@/components/page-header";
import { ConsultationsView } from "@/features/consultations/components/consultations-view";
import { NewConsultationDialog } from "@/features/consultations/components/new-consultation-dialog";

export default function ConsultasPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Consultas/Tratamientos"
        description="Historial de todo lo realizado a los pacientes."
        action={<NewConsultationDialog />}
      />

      <ConsultationsView />
    </div>
  );
}
