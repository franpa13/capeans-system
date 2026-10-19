import type { PaymentMethod } from "@prisma/client";

/** In the order they're offered in the form and listed on Ingresos. */
export const PAYMENT_METHODS: PaymentMethod[] = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "OTRO"];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  OTRO: "Otro",
};

export function paymentTotals(payments: { amount: number; method: PaymentMethod }[]) {
  const byMethod = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, 0])) as Record<
    PaymentMethod,
    number
  >;
  let total = 0;
  for (const p of payments) {
    byMethod[p.method] += p.amount;
    total += p.amount;
  }
  return { total, byMethod };
}
