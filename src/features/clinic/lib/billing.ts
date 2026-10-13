export type PaymentStatus = "SIN_MONTO" | "PENDIENTE" | "PARCIAL" | "COBRADO";

/** Derived, never stored: a consultation's payment status is always
 * computed from amountCharged/amountPaid, so it can never drift out of
 * sync with them the way a separately-saved status column could.
 *
 * COBRADO is checked before PENDIENTE on purpose: a treatment priced at
 * exactly $0 has amountPaid (0) >= amountCharged (0), which should read
 * as settled, not as "nothing paid yet". */
export function paymentStatus(
  amountCharged: number | null,
  amountPaid: number,
): PaymentStatus {
  if (amountCharged == null) return "SIN_MONTO";
  if (amountPaid >= amountCharged) return "COBRADO";
  if (amountPaid <= 0) return "PENDIENTE";
  return "PARCIAL";
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  SIN_MONTO: "Sin monto",
  PENDIENTE: "Pendiente",
  PARCIAL: "Parcial",
  COBRADO: "Cobrado",
};

/** Total still owed across a set of consultations — a patient's balance
 * (their own consultations) or the clinic's "Por cobrar" figure (every
 * consultation). Consultations with no amountCharged don't contribute
 * (never priced, not a debt). Math.max(0, …) means one accidentally
 * overpaid consultation can't offset what's owed on another. */
export function outstandingBalance(
  consultations: { amountCharged: number | null; amountPaid: number }[],
): number {
  return consultations.reduce((sum, c) => {
    if (c.amountCharged == null) return sum;
    return sum + Math.max(0, c.amountCharged - c.amountPaid);
  }, 0);
}
