import { PatientDetailView } from "@/features/patients/components/patient-detail-view";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getPatient } from "@/features/clinic/data/patients";
import { getConsultationsForPatient } from "@/features/clinic/data/consultations";

export default async function PacienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clinic = await getCurrentClinic();
  const patient = clinic ? await getPatient(clinic.id, id) : null;
  const consultations = clinic ? await getConsultationsForPatient(clinic.id, id) : [];

  return <PatientDetailView patient={patient} consultations={consultations} />;
}
