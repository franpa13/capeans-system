import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getMedicalOrder } from "@/features/clinic/data/medical-orders";
import { orderNumber } from "@/features/clinic/lib/orders";
import { OrderSheet } from "@/features/orders/components/order-sheet";
import { PrintOnLoad } from "@/features/prescriptions/components/print-on-load";

/** The orden alone, sized to an A5 sheet: opens the print dialog, where
 * it can also be saved as a PDF. */
export default async function ImprimirOrdenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clinic = await getCurrentClinic();
  const order = clinic ? await getMedicalOrder(clinic.id, id) : null;

  if (!clinic || !order) {
    return <p className="p-8 text-center">No se encontró la orden.</p>;
  }

  return (
    <main className="min-h-screen bg-neutral-200 py-8 print:min-h-0 print:bg-white print:py-0">
      <title>{`Orden ${orderNumber(order.number)} - ${order.patient.name}`}</title>
      <style>{"@page { size: A5; margin: 0; } @media print { body { background: white; } }"}</style>
      <div className="mx-auto max-w-[148mm] print:max-w-none">
        <OrderSheet order={order} patient={order.patient} clinic={clinic} />
      </div>
      <PrintOnLoad />
    </main>
  );
}
