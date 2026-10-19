"use client";

import type { PaymentMethod } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/features/clinic/lib/payments";

/** Efectivo / Transferencia / Tarjeta / Otro, as the same segmented
 * buttons as "Estado del cobro" — one tap, no dropdown to open. */
export function PaymentMethodPicker({
  value,
  onChange,
  label = "Medio de pago",
}: {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  label?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div role="radiogroup" aria-label={label} className="flex w-fit flex-wrap gap-1 rounded-md border p-1">
        {PAYMENT_METHODS.map((method) => (
          <Button
            key={method}
            type="button"
            size="sm"
            role="radio"
            aria-checked={value === method}
            variant={value === method ? "secondary" : "ghost"}
            onClick={() => onChange(method)}
          >
            {PAYMENT_METHOD_LABELS[method]}
          </Button>
        ))}
      </div>
    </div>
  );
}
