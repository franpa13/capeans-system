import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ExcelDownloadButton } from "@/features/excel/components/excel-download-button";
import { ConsultationsView } from "@/features/consultations/components/consultations-view";
import { NewConsultationDialog } from "@/features/consultations/components/new-consultation-dialog";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getConsultations } from "@/features/clinic/data/consultations";
import { getPatients } from "@/features/clinic/data/patients";
import { getClinicOptions } from "@/features/clinic/data/clinic-options";
import { getSupplies } from "@/features/clinic/data/supplies";
import { parsePaymentStatusParam } from "@/features/clinic/lib/billing";

export default async function ConsultasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const asString = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : undefined;
  const cobroParam = asString(params.cobro);
  const filters = {
    treatment: asString(params.tratamiento),
    from: asString(params.desde),
    to: asString(params.hasta),
    patientQuery: asString(params.paciente),
    tooth: asString(params.pieza),
    paymentStatus: parsePaymentStatusParam(cobroParam),
  };

  const clinic = await getCurrentClinic();
  const [patients, treatmentOptions, insuranceOptions, supplies] = clinic
    ? await Promise.all([
        getPatients(clinic.id),
        getClinicOptions(clinic.id, "treatment"),
        getClinicOptions(clinic.id, "insurance"),
        getSupplies(clinic.id),
      ])
    : [[], [], [], []];
  const supplyOptions = supplies.map((s) => ({ id: s.id, name: s.name, unit: s.unit }));
  const treatmentLabels = treatmentOptions.map((o) => o.label);
  // A new consulta offers only active tratamientos; the list's filter keeps
  // all of them, to find past consultas of one that's no longer done.
  const activeTreatmentLabels = treatmentOptions.filter((o) => o.active).map((o) => o.label);
  const insuranceLabels = insuranceOptions.map((o) => o.label);
  const treatmentPrices = Object.fromEntries(
    treatmentOptions.filter((o) => o.price != null).map((o) => [o.label, o.price!]),
  );
  const treatmentCashPrices = Object.fromEntries(
    treatmentOptions.filter((o) => o.cashPrice != null).map((o) => [o.label, o.cashPrice!]),
  );
  const consultations = clinic
    ? await getConsultations(clinic.id, filters, treatmentLabels)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Consultas/Tratamientos"
        description="Historial de todo lo realizado a los pacientes."
        icon={ClipboardList}
        action={
          <div className="flex flex-wrap gap-2">
            <ExcelDownloadButton path="/api/excel/consultas" />
            <NewConsultationDialog
              patients={patients}
              treatmentOptions={activeTreatmentLabels}
              treatmentPrices={treatmentPrices}
              treatmentCashPrices={treatmentCashPrices}
              insuranceOptions={insuranceLabels}
              supplyOptions={supplyOptions}
            />
          </div>
        }
      />

      <ConsultationsView
        consultations={consultations}
        patients={patients}
        treatmentOptions={treatmentLabels}
        treatmentPrices={treatmentPrices}
        treatmentCashPrices={treatmentCashPrices}
        supplyOptions={supplyOptions}
      />
    </div>
  );
}
