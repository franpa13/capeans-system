import Link from "next/link";
import { Eye, HandCoins, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NoPermission } from "@/components/no-permission";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { hasPermission } from "@/features/clinic/data/current-member";
import { getLiquidations, periodDay, periodLastDay } from "@/features/clinic/data/liquidations";
import { getProfessionals } from "@/features/clinic/data/professionals";
import { formatCurrency } from "@/features/clinic/lib/format";
import { LIQUIDATION_MODES, isLiquidationMode, liquidationNumber } from "@/features/clinic/lib/liquidations";
import { LiquidationFilters } from "@/features/liquidations/components/liquidation-filters";
import { PaidBadge } from "@/features/liquidations/components/paid-badge";

export default async function LiquidacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ profesional?: string; modo?: string }>;
}) {
  if (!(await hasPermission("income.view"))) return <NoPermission what="las liquidaciones" />;
  const { profesional, modo } = await searchParams;
  const clinic = await getCurrentClinic();
  const [liquidations, professionals] = clinic
    ? await Promise.all([
        getLiquidations(clinic.id, { professionalId: profesional, mode: modo }),
        getProfessionals(clinic.id),
      ])
    : [[], []];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Liquidaciones"
        description="Lo que le corresponde a cada profesional por lo cobrado de sus consultas."
        icon={HandCoins}
        action={
          <Button asChild>
            <Link href="/dashboard/liquidaciones/nueva">
              <Plus />
              Nueva liquidación
            </Link>
          </Button>
        }
      />
      <LiquidationFilters
        professionals={professionals.map((p) => ({ id: p.id, label: `${p.title} ${p.name}` }))}
        professionalId={profesional ?? ""}
        mode={modo ?? ""}
      />
      <Card>
        <CardContent>
          {liquidations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <HandCoins className="size-6" />
              <p className="font-medium text-foreground">No hay liquidaciones todavía</p>
              <p className="text-sm">Hacé la primera desde “Nueva liquidación”.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Profesional</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead className="text-right">Cobrado</TableHead>
                  <TableHead className="text-right">Comisión</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liquidations.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="tabular-nums">{liquidationNumber(l.number)}</TableCell>
                    <TableCell className="font-medium">{l.professionalName}</TableCell>
                    <TableCell className="tabular-nums">
                      {periodDay(l.periodFrom)} al {periodLastDay(l.periodTo)}
                    </TableCell>
                    <TableCell>{isLiquidationMode(l.mode) ? LIQUIDATION_MODES[l.mode].label : l.mode}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(l.totalCollected)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(l.totalCommission)}
                    </TableCell>
                    <TableCell>
                      <PaidBadge paidAt={l.paidAt} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          href={`/dashboard/liquidaciones/${l.id}`}
                          aria-label={`Ver liquidación ${liquidationNumber(l.number)}`}
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
    </div>
  );
}
