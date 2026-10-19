"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { Payment, PaymentMethod } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate, toLocalDateString } from "@/features/clinic/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/features/clinic/lib/payments";
import { paymentStatus, PAYMENT_STATUS_LABELS } from "@/features/clinic/lib/billing";
import {
  addPaymentAction,
  deletePaymentAction,
  getConsultationPaymentsAction,
} from "@/features/consultations/actions";
import { PaymentMethodPicker } from "@/features/consultations/components/payment-method-picker";
import { parseAmount } from "@/features/consultations/lib/schema";
import { unwrap } from "@/lib/action-result";

/** The consulta's payments, each with its date and method, and a form to
 * register the next one (an installment, or the rest of the balance).
 * Payments save on their own, independently of "Guardar cambios". */
export function PaymentsSection({
  consultationId,
  amountCharged,
}: {
  consultationId: string;
  /** The saved amount to charge — payments are checked against it. */
  amountCharged: number | null;
}) {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("EFECTIVO");
  const [paidAt, setPaidAt] = useState(() => toLocalDateString(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const paid = payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
  const balance = amountCharged != null ? Math.max(0, amountCharged - paid) : 0;

  async function load() {
    const list = await unwrap(getConsultationPaymentsAction(consultationId));
    setPayments(list);
    const owed = amountCharged != null ? amountCharged - list.reduce((s, p) => s + p.amount, 0) : 0;
    setAmount(owed > 0 ? String(owed) : "");
  }

  useEffect(() => {
    let cancelled = false;
    unwrap(getConsultationPaymentsAction(consultationId))
      .then((list) => {
        if (cancelled) return;
        setPayments(list);
        const owed =
          amountCharged != null ? amountCharged - list.reduce((s, p) => s + p.amount, 0) : 0;
        setAmount(owed > 0 ? String(owed) : "");
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar los pagos. Cerrá y volvé a abrir.");
      });
    return () => {
      cancelled = true;
    };
  }, [consultationId, amountCharged]);

  async function handleAdd() {
    const value = parseAmount(amount.trim());
    if (value === null || value === 0) {
      setError("Ingresá un monto entero mayor a 0, sin puntos ni comas (ej: 15000)");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await unwrap(
        addPaymentAction(consultationId, {
          amount: value,
          method,
          // Noon, so the day can't shift with the time zone.
          paidAt: new Date(`${paidAt}T12:00:00`),
        }),
      );
      await load();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el pago");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(payment: Payment) {
    setError(null);
    try {
      await unwrap(deletePaymentAction(consultationId, payment.id));
      await load();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar el pago");
    }
  }

  const status = paymentStatus(amountCharged, paid);

  return (
    <section aria-labelledby="payments-title" className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="payments-title" className="text-sm font-medium">
          Pagos
        </h3>
        {payments && amountCharged != null && (
          <p className="text-sm text-muted-foreground">
            {PAYMENT_STATUS_LABELS[status]} · Pagado: {formatCurrency(paid)} de{" "}
            {formatCurrency(amountCharged)} · Saldo: {formatCurrency(balance)}
          </p>
        )}
      </div>

      {payments === null ? (
        !error && <p className="text-sm text-muted-foreground">Cargando pagos...</p>
      ) : payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no se registró ningún pago.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {payments.map((payment) => (
            <li key={payment.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
              <span>
                {formatDate(toLocalDateString(payment.paidAt))} · {PAYMENT_METHOD_LABELS[payment.method]}
              </span>
              <span className="flex items-center gap-1">
                <span className="font-medium">{formatCurrency(payment.amount)}</span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Borrar pago de ${formatCurrency(payment.amount)}`}
                  onClick={() => handleDelete(payment)}
                >
                  <Trash2 />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {amountCharged == null ? (
        <p className="text-sm text-muted-foreground">
          Para registrar pagos, primero cargá el monto a cobrar y guardá los cambios.
        </p>
      ) : (
        balance > 0 &&
        payments && (
          <div className="space-y-3 border-t pt-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="space-y-2">
                <Label htmlFor="newPaymentAmount">Monto del pago</Label>
                <Input
                  id="newPaymentAmount"
                  type="number"
                  min={1}
                  className="sm:w-40"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPaymentDate">Fecha</Label>
                <Input
                  id="newPaymentDate"
                  type="date"
                  className="sm:w-44"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                />
              </div>
            </div>
            <PaymentMethodPicker value={method} onChange={setMethod} />
            <Button type="button" variant="secondary" disabled={saving} onClick={handleAdd}>
              <Plus />
              Registrar pago
            </Button>
          </div>
        )
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
