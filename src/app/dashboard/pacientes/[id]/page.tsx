import { PatientDetailView } from "@/features/patients/components/patient-detail-view";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getPatient } from "@/features/clinic/data/patients";
import { getConsultationsForPatient } from "@/features/clinic/data/consultations";
import { getClinicOptions } from "@/features/clinic/data/clinic-options";
import { outstandingBalance } from "@/features/clinic/lib/billing";
import { getSupplies } from "@/features/clinic/data/supplies";
import { countNoShows, getPatientAppointments } from "@/features/clinic/data/appointments";
import { getPatientNotes } from "@/features/clinic/data/patient-notes";
import { getToothFindings } from "@/features/clinic/data/tooth-findings";
import { getPatientPayments } from "@/features/clinic/data/payments";
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
  const appointments = clinic && patient ? await getPatientAppointments(clinic.id, id) : [];
  const notes = clinic && patient ? await getPatientNotes(clinic.id, id) : [];
  const payments = clinic && patient ? await getPatientPayments(clinic.id, id) : [];
  const findings = clinic && patient ? await getToothFindings(clinic.id, id) : [];

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
      appointments={appointments}
      notes={notes.map((n) => ({
        id: n.id,
        text: n.text,
        authorName: n.authorName,
        createdAt: n.createdAt,
      }))}
      payments={payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        paidAt: p.paidAt,
        treatment: p.consultation.treatment,
      }))}
      findings={findings.map((f) => ({
        id: f.id,
        tooth: f.tooth,
        surface: f.surface,
        condition: f.condition,
        status: f.status,
        notes: f.notes,
        authorName: f.authorName,
        createdAt: f.createdAt,
        resolvedAt: f.resolvedAt,
        consultationId: f.consultationId,
      }))}
    />
  );
}
