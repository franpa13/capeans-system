import { PatientDetailView } from "@/features/patients/components/patient-detail-view";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getPatient } from "@/features/clinic/data/patients";
import { getConsultationsForPatient } from "@/features/clinic/data/consultations";
import { getClinicOptions } from "@/features/clinic/data/clinic-options";

export default async function PacienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clinic = await getCurrentClinic();
  const patient = clinic ? await getPatient(clinic.id, id) : null;
  const consultations = clinic ? await getConsultationsForPatient(clinic.id, id) : [];
  const treatmentOptions = clinic ? await getClinicOptions(clinic.id, "treatment") : [];

  return (
    <PatientDetailView
      patient={patient}
      consultations={consultations}
      treatmentOptions={treatmentOptions.map((o) => o.label)}
    />
  );
}
