import { Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ExcelDownloadButton } from "@/features/excel/components/excel-download-button";
import { ImportExcelDialog } from "@/features/excel/components/import-excel-dialog";
import { PatientsView } from "@/features/patients/components/patients-view";
import { NewPatientDialog } from "@/features/patients/components/new-patient-dialog";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getPatients } from "@/features/clinic/data/patients";
import { getClinicOptions } from "@/features/clinic/data/clinic-options";

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : undefined;
  const insurance = typeof params.obra === "string" ? params.obra : undefined;

  const clinic = await getCurrentClinic();
  const insuranceOptions = clinic ? await getClinicOptions(clinic.id, "insurance") : [];
  const insuranceLabels = insuranceOptions.map((o) => o.label);
  const patients = clinic
    ? await getPatients(clinic.id, { query, insurance }, insuranceLabels)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pacientes"
        description="Buscá pacientes existentes o cargá uno nuevo."
        icon={Users}
        action={
          <div className="flex flex-wrap gap-2">
            <ImportExcelDialog kind="pacientes" />
            <ExcelDownloadButton path="/api/excel/pacientes" />
            <NewPatientDialog insuranceOptions={insuranceLabels} />
          </div>
        }
      />

      <PatientsView patients={patients} insuranceOptions={insuranceLabels} />
    </div>
  );
}
