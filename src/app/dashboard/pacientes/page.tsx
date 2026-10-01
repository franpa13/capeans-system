import { PageHeader } from "@/components/page-header";
import { PatientsView } from "@/features/patients/components/patients-view";
import { NewPatientDialog } from "@/features/patients/components/new-patient-dialog";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getPatients } from "@/features/clinic/data/patients";

export default async function PacientesPage() {
  const clinic = await getCurrentClinic();
  const patients = clinic ? await getPatients(clinic.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pacientes"
        description="Buscá pacientes existentes o cargá uno nuevo."
        action={<NewPatientDialog />}
      />

      <PatientsView patients={patients} />
    </div>
  );
}
