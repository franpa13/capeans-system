import Link from "next/link";
import { Banknote, CalendarDays, ChevronLeft, ChevronRight, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, toLocalDateString } from "@/features/clinic/lib/format";
import { addMonths, formatMonth, toMonthParam } from "@/features/clinic/lib/month";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  paymentTotals,
} from "@/features/clinic/lib/payments";
import type { PaymentWithConsultation } from "@/features/clinic/data/payments";

function SummaryCard({
  icon: Icon,
  title,
  amount,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  amount: number;
  detail?: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription className="text-lg font-semibold text-foreground">
          {formatCurrency(amount)}
        </CardDescription>
      </CardHeader>
      {detail && <CardContent className="text-sm text-muted-foreground">{detail}</CardContent>}
    </Card>
  );
}

export function IncomeView({
  monthStart,
  monthPayments,
  todayTotal,
}: {
  monthStart: Date;
  monthPayments: PaymentWithConsultation[];
  todayTotal: number;
}) {
  const { total, byMethod } = paymentTotals(monthPayments);
  const monthHref = (offset: number) =>
    `/dashboard/ingresos?mes=${toMonthParam(addMonths(monthStart, offset))}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" asChild>
          <Link href={monthHref(-1)} aria-label="Mes anterior">
            <ChevronLeft />
          </Link>
        </Button>
        <Button variant="outline" size="icon" asChild>
          <Link href={monthHref(1)} aria-label="Mes siguiente">
            <ChevronRight />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/ingresos">Este mes</Link>
        </Button>
        <span className="ml-2 text-sm font-medium">{formatMonth(monthStart)}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard icon={CalendarDays} title="Hoy" amount={todayTotal} />
        <SummaryCard
          icon={Wallet}
          title={`En ${formatMonth(monthStart)}`}
          amount={total}
          detail={`${monthPayments.length} ${monthPayments.length === 1 ? "pago" : "pagos"}`}
        />
        <Card className="h-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Banknote className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Por medio de pago</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {PAYMENT_METHODS.map((method) => (
                <li key={method} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{PAYMENT_METHOD_LABELS[method]}</span>
                  <span className="font-medium">{formatCurrency(byMethod[method])}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {monthPayments.length === 0 ? (
        <div className="rounded-lg border p-8">
          <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
            <Banknote className="size-5" />
            No hay pagos registrados en {formatMonth(monthStart)}.
          </div>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead className="hidden sm:table-cell">Tratamiento</TableHead>
                <TableHead>Medio</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthPayments.map((payment) => {
                const patient = payment.consultation.patient;
                return (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(toLocalDateString(payment.paidAt))}</TableCell>
                    <TableCell className="font-medium">
                      {patient ? (
                        <Link href={`/dashboard/pacientes/${patient.id}`} className="hover:underline">
                          {patient.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Paciente eliminado</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {payment.consultation.treatment}
                    </TableCell>
                    <TableCell>{PAYMENT_METHOD_LABELS[payment.method]}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
