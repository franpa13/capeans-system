import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getPrescription } from "@/features/clinic/data/prescriptions";
import { prescriptionNumber } from "@/features/clinic/lib/prescriptions";
import { PrescriptionSheet } from "@/features/prescriptions/components/prescription-sheet";
import { PrintOnLoad } from "@/features/prescriptions/components/print-on-load";
import { hasPermission } from "@/features/clinic/data/current-member";
import { NoPermission } from "@/components/no-permission";

/** The receta alone, outside the dashboard, sized to an A5 sheet: opens
 * the browser's print dialog, where it can also be saved as a PDF. */
export default async function ImprimirRecetaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await hasPermission("clinical.view"))) return <NoPermission what="las recetas" />;
  const clinic = await getCurrentClinic();
  const prescription = clinic ? await getPrescription(clinic.id, id) : null;

  if (!clinic || !prescription) {
    return <p className="p-8 text-center">No se encontró la receta.</p>;
  }

  return (
    <main className="min-h-screen bg-neutral-200 py-8 print:min-h-0 print:bg-white print:py-0">
      <title>{`Receta ${prescriptionNumber(prescription.number)} - ${prescription.patient.name}`}</title>
      <style>{"@page { size: A5; margin: 0; } @media print { body { background: white; } }"}</style>
      <div className="mx-auto max-w-[148mm] print:max-w-none">
        <PrescriptionSheet prescription={prescription} patient={prescription.patient} clinic={clinic} />
      </div>
      <PrintOnLoad />
    </main>
  );
}
