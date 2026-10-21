import { HandCoins } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { NoPermission } from "@/components/no-permission";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { hasPermission } from "@/features/clinic/data/current-member";
import { getLiquidation, periodDay, periodLastDay } from "@/features/clinic/data/liquidations";
import { formatCurrency } from "@/features/clinic/lib/format";
import { LIQUIDATION_MODES, isLiquidationMode, liquidationNumber } from "@/features/clinic/lib/liquidations";
import { LiquidationActions } from "@/features/liquidations/components/liquidation-actions";
import { LiquidationLines } from "@/features/liquidations/components/liquidation-lines";
import { PaidBadge } from "@/features/liquidations/components/paid-badge";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="font-medium">{children}</div>
    </div>
  );
}

export default async function LiquidacionPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPermission("income.view"))) return <NoPermission what="las liquidaciones" />;
  const { id } = await params;
  const clinic = await getCurrentClinic();
  const liquidation = clinic ? await getLiquidation(clinic.id, id) : null;
  if (!liquidation) return <p className="text-muted-foreground">No se encontró la liquidación.</p>;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Liquidación ${liquidationNumber(liquidation.number)}`}
        description={`${clinic!.name} · ${liquidation.professionalName}`}
        icon={HandCoins}
        action={<LiquidationActions id={liquidation.id} paid={!!liquidation.paidAt} />}
      />
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-5">
          <Fact label="Profesional">{liquidation.professionalName}</Fact>
          <Fact label="Período">
            {periodDay(liquidation.periodFrom)} al {periodLastDay(liquidation.periodTo)}
          </Fact>
          <Fact label="Modo">
            {isLiquidationMode(liquidation.mode) ? LIQUIDATION_MODES[liquidation.mode].label : liquidation.mode}
          </Fact>
          <Fact label="A pagar">
            <span className="text-xl font-bold tabular-nums">{formatCurrency(liquidation.totalCommission)}</span>
          </Fact>
          <Fact label="Estado">
            <PaidBadge paidAt={liquidation.paidAt} />
          </Fact>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <LiquidationLines
            lines={liquidation.lines}
            totalCollected={liquidation.totalCollected}
            totalCommission={liquidation.totalCommission}
          />
        </CardContent>
      </Card>
    </div>
  );
}
