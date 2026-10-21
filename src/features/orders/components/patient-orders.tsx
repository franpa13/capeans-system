import Link from "next/link";
import { ClipboardPlus, Eye } from "lucide-react";

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
import { formatDate, toLocalDateString } from "@/features/clinic/lib/format";
import { ORDER_KINDS, isOrderKind, orderNumber } from "@/features/clinic/lib/orders";
import { NewOrderDialog } from "@/features/orders/components/new-order-dialog";
import type { ProfessionalOption } from "@/features/prescriptions/components/new-prescription-dialog";

export type OrderListItem = {
  id: string;
  number: number;
  date: Date;
  kind: string;
  items: string[];
  professionalTitle: string;
  professionalName: string;
};

/** The ficha's "Órdenes": studies, lab tests and referrals asked for. */
export function PatientOrders({
  patientId,
  patientName,
  orders,
  professionals,
}: {
  patientId: string;
  patientName: string;
  orders: OrderListItem[];
  professionals: ProfessionalOption[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Órdenes</CardTitle>
          <CardDescription>Estudios por imágenes, laboratorio y derivaciones.</CardDescription>
        </div>
        <NewOrderDialog patientId={patientId} patientName={patientName} professionals={professionals} />
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ClipboardPlus className="size-4" />
            Todavía no se le hicieron órdenes.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Solicita</TableHead>
                <TableHead>Profesional</TableHead>
                <TableHead className="text-right">Ver</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="tabular-nums">{orderNumber(o.number)}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(toLocalDateString(o.date))}</TableCell>
                  <TableCell>{isOrderKind(o.kind) ? ORDER_KINDS[o.kind].label : o.kind}</TableCell>
                  <TableCell className="whitespace-normal">{o.items.join(", ")}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {o.professionalTitle} {o.professionalName}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link
                        href={`/dashboard/pacientes/${patientId}/ordenes/${o.id}`}
                        aria-label={`Ver orden ${orderNumber(o.number)}`}
                      >
                        <Eye />
                        Ver
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
