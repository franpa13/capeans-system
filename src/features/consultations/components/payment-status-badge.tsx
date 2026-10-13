import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/features/clinic/lib/format";
import { paymentStatus, PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/features/clinic/lib/billing";

const STYLES: Record<Exclude<PaymentStatus, "SIN_MONTO">, string> = {
  PENDIENTE: "bg-destructive/10 text-destructive border-destructive/20",
  PARCIAL:
    "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-400",
  COBRADO:
    "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400",
};

/** Renders nothing for SIN_MONTO — a consultation nobody priced isn't a
 * debt, so it shouldn't visually compete with the ones that are. */
export function PaymentStatusBadge({
  amountCharged,
  amountPaid,
}: {
  amountCharged: number | null;
  amountPaid: number;
}) {
  const status = paymentStatus(amountCharged, amountPaid);
  if (status === "SIN_MONTO") return null;

  return (
    <Badge variant="outline" className={STYLES[status]}>
      {PAYMENT_STATUS_LABELS[status]} · {formatCurrency(amountCharged!)}
    </Badge>
  );
}
