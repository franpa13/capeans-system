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

/** The combined value the dashboard's "Por cobrar" card links with
 * (?cobro=PENDIENTE,PARCIAL). Lives here (not in the "use client" filter
 * bar) because the dashboard page that builds the link is a Server
 * Component — importing even a plain string constant from a "use client"
 * module turns it into an opaque client reference when read on the
 * server, not its actual value. */
export const PENDING_OR_PARTIAL = "PENDIENTE,PARCIAL";

const VALID_PAYMENT_STATUSES = new Set(Object.keys(PAYMENT_STATUS_LABELS));

/** Parses the Consultas page's untrusted `?cobro=` URL param into a list
 * of real PaymentStatus values — an unrecognized value (a typo, a stale
 * bookmark, someone editing the URL by hand) is dropped rather than
 * passed through to a data-layer filter that would otherwise just match
 * nothing and show an empty list with no explanation. */
export function parsePaymentStatusParam(raw: string | undefined): PaymentStatus[] | undefined {
  if (!raw) return undefined;
  const values = raw.split(",").filter((v): v is PaymentStatus => VALID_PAYMENT_STATUSES.has(v));
  return values.length > 0 ? values : undefined;
}

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
