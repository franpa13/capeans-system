import { PatientDetailView } from "@/features/patients/components/patient-detail-view";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getPatient } from "@/features/clinic/data/patients";
import { getConsultationsForPatient } from "@/features/clinic/data/consultations";
import { getClinicOptions } from "@/features/clinic/data/clinic-options";
import { outstandingBalance } from "@/features/clinic/lib/billing";
import { getSupplies } from "@/features/clinic/data/supplies";
import { countNoShows } from "@/features/clinic/data/appointments";
import { getPatientFiles } from "@/features/clinic/data/patient-files";

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
  const treatmentPrices = Object.fromEntries(
    treatmentOptions.filter((o) => o.price != null).map((o) => [o.label, o.price!]),
  );
  const treatmentCashPrices = Object.fromEntries(
    treatmentOptions.filter((o) => o.cashPrice != null).map((o) => [o.label, o.cashPrice!]),
  );
  const supplies = clinic ? await getSupplies(clinic.id) : [];
  const supplyOptions = supplies.map((s) => ({ id: s.id, name: s.name, unit: s.unit }));
  const balance = outstandingBalance(consultations);
  const noShows = clinic ? await countNoShows(clinic.id, id) : 0;
  const files = clinic && patient ? await getPatientFiles(clinic.id, id) : [];

  return (
    <PatientDetailView
      patient={patient}
      consultations={consultations}
      treatmentOptions={treatmentOptions.filter((o) => o.active).map((o) => o.label)}
      treatmentPrices={treatmentPrices}
      treatmentCashPrices={treatmentCashPrices}
      supplyOptions={supplyOptions}
      balance={balance}
      noShows={noShows}
      files={files.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        mimeType: f.mimeType,
        createdAt: f.createdAt,
      }))}
    />
  );
}
