import { PatientDetailView } from "@/features/patients/components/patient-detail-view";

export default async function PacienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PatientDetailView patientId={id} />;
}
