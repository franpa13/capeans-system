import { Wallet } from "lucide-react";
import type { PaymentMethod } from "@prisma/client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, toLocalDateString } from "@/features/clinic/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/features/clinic/lib/payments";

export type PatientPaymentItem = {
  id: string;
  amount: number;
  method: PaymentMethod;
  paidAt: Date;
  treatment: string;
};

/** The ficha's "Pagos": what the patient paid, when and how, with what
 * they still owe. */
export function PatientPayments({
  payments,
  balance,
}: {
  payments: PatientPaymentItem[];
  balance: number;
}) {
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">Total pagado</span>
            <span className="text-2xl font-semibold tabular-nums">{formatCurrency(paid)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">Saldo pendiente</span>
            <span
              className={`text-2xl font-semibold tabular-nums ${balance > 0 ? "text-destructive" : ""}`}
            >
              {balance > 0 ? formatCurrency(balance) : "Al día"}
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        {payments.length === 0 ? (
          <CardContent className="flex flex-col items-center gap-2 py-4 text-center text-muted-foreground">
            <Wallet className="size-5" />
            Todavía no hay pagos registrados.
          </CardContent>
        ) : (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tratamiento</TableHead>
                  <TableHead>Medio de pago</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="tabular-nums">
                      {formatDate(toLocalDateString(p.paidAt))}
                    </TableCell>
                    <TableCell>{p.treatment}</TableCell>
                    <TableCell>{PAYMENT_METHOD_LABELS[p.method]}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(p.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
