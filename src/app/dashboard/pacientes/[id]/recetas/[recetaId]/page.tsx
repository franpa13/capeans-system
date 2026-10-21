import { Pill } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getPrescription } from "@/features/clinic/data/prescriptions";
import { prescriptionMessage, prescriptionNumber } from "@/features/clinic/lib/prescriptions";
import { toWhatsAppNumber, whatsAppLink } from "@/features/appointments/lib/reminder";
import { PrescriptionSheet } from "@/features/prescriptions/components/prescription-sheet";
import { DocumentActions } from "@/features/documents/components/document-actions";
import { hasPermission } from "@/features/clinic/data/current-member";
import { NoPermission } from "@/components/no-permission";

export default async function RecetaPage({
  params,
}: {
  params: Promise<{ id: string; recetaId: string }>;
}) {
  const { id, recetaId } = await params;
  if (!(await hasPermission("clinical.view"))) return <NoPermission what="las recetas" />;
  const clinic = await getCurrentClinic();
  const prescription = clinic ? await getPrescription(clinic.id, recetaId) : null;

  if (!clinic || !prescription || prescription.patientId !== id) {
    return <p className="text-muted-foreground">No se encontró la receta.</p>;
  }

  const number = toWhatsAppNumber(prescription.patient.phone);
  const whatsAppHref = number
    ? whatsAppLink(
        number,
        prescriptionMessage({
          patientName: prescription.patient.name,
          clinicName: clinic.name,
          items: prescription.items,
          instructions: prescription.instructions,
        }),
      )
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Receta ${prescriptionNumber(prescription.number)}`}
        description={`${prescription.patient.name} · ${prescription.professionalTitle} ${prescription.professionalName}`}
        icon={Pill}
        action={
          <DocumentActions kind="receta" patientId={id} documentId={prescription.id} whatsAppHref={whatsAppHref} />
        }
      />
      <div className="rounded-xl border bg-muted/40 p-4 sm:p-8">
        <PrescriptionSheet prescription={prescription} patient={prescription.patient} clinic={clinic} />
      </div>
    </div>
  );
}
