import { ClipboardPlus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getMedicalOrder } from "@/features/clinic/data/medical-orders";
import { isOrderKind, orderMessage, orderNumber } from "@/features/clinic/lib/orders";
import { toWhatsAppNumber, whatsAppLink } from "@/features/appointments/lib/reminder";
import { OrderSheet } from "@/features/orders/components/order-sheet";
import { DocumentActions } from "@/features/documents/components/document-actions";

export default async function OrdenPage({
  params,
}: {
  params: Promise<{ id: string; ordenId: string }>;
}) {
  const { id, ordenId } = await params;
  const clinic = await getCurrentClinic();
  const order = clinic ? await getMedicalOrder(clinic.id, ordenId) : null;

  if (!clinic || !order || order.patientId !== id) {
    return <p className="text-muted-foreground">No se encontró la orden.</p>;
  }

  const number = toWhatsAppNumber(order.patient.phone);
  const whatsAppHref =
    number && isOrderKind(order.kind)
      ? whatsAppLink(
          number,
          orderMessage({
            patientName: order.patient.name,
            clinicName: clinic.name,
            kind: order.kind,
            items: order.items,
            diagnosis: order.diagnosis,
          }),
        )
      : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Orden ${orderNumber(order.number)}`}
        description={`${order.patient.name} · ${order.professionalTitle} ${order.professionalName}`}
        icon={ClipboardPlus}
        action={<DocumentActions kind="orden" patientId={id} documentId={order.id} whatsAppHref={whatsAppHref} />}
      />
      <div className="rounded-xl border bg-muted/40 p-4 sm:p-8">
        <OrderSheet order={order} patient={order.patient} clinic={clinic} />
      </div>
    </div>
  );
}
