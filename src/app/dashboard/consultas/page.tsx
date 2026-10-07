import { PageHeader } from "@/components/page-header";
import { ConsultationsView } from "@/features/consultations/components/consultations-view";
import { NewConsultationDialog } from "@/features/consultations/components/new-consultation-dialog";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getConsultations } from "@/features/clinic/data/consultations";
import { getPatients } from "@/features/clinic/data/patients";
import { getClinicOptions } from "@/features/clinic/data/clinic-options";

export default async function ConsultasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const asString = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : undefined;
  const filters = {
    treatment: asString(params.tratamiento),
    from: asString(params.desde),
    to: asString(params.hasta),
    patientQuery: asString(params.paciente),
    tooth: asString(params.pieza),
  };

  const clinic = await getCurrentClinic();
  const [patients, treatmentOptions, insuranceOptions] = clinic
    ? await Promise.all([
        getPatients(clinic.id),
        getClinicOptions(clinic.id, "treatment"),
        getClinicOptions(clinic.id, "insurance"),
      ])
    : [[], [], []];
  const treatmentLabels = treatmentOptions.map((o) => o.label);
  const insuranceLabels = insuranceOptions.map((o) => o.label);
  const consultations = clinic
    ? await getConsultations(clinic.id, filters, treatmentLabels)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Consultas/Tratamientos"
        description="Historial de todo lo realizado a los pacientes."
        action={
          <NewConsultationDialog
            patients={patients}
            treatmentOptions={treatmentLabels}
            insuranceOptions={insuranceLabels}
          />
        }
      />

      <ConsultationsView
        consultations={consultations}
        patients={patients}
        treatmentOptions={treatmentLabels}
      />
    </div>
  );
}
