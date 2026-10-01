import { PageHeader } from "@/components/page-header";
import { PatientsView } from "@/features/patients/components/patients-view";
import { NewPatientDialog } from "@/features/patients/components/new-patient-dialog";

export default function PacientesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pacientes"
        description="Buscá pacientes existentes o cargá uno nuevo."
        action={<NewPatientDialog />}
      />

      <PatientsView />
    </div>
  );
}
