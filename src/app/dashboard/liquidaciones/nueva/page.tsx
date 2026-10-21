import Link from "next/link";
import { ArrowLeft, HandCoins } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { NoPermission } from "@/components/no-permission";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { hasPermission } from "@/features/clinic/data/current-member";
import { getProfessionals } from "@/features/clinic/data/professionals";
import { toLocalDateString } from "@/features/clinic/lib/format";
import { NewLiquidationForm } from "@/features/liquidations/components/new-liquidation-form";

export default async function NuevaLiquidacionPage() {
  if (!(await hasPermission("income.view"))) return <NoPermission what="las liquidaciones" />;
  const clinic = await getCurrentClinic();
  const professionals = clinic ? await getProfessionals(clinic.id) : [];
  // The current month, by default.
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nueva liquidación"
        description="Calculá la comisión de un profesional por período."
        icon={HandCoins}
        action={
          <Button variant="outline" asChild>
            <Link href="/dashboard/liquidaciones">
              <ArrowLeft />
              Volver
            </Link>
          </Button>
        }
      />
      {professionals.length === 0 ? (
        <p className="text-muted-foreground">
          Primero cargá los profesionales (y su % de comisión) en{" "}
          <Link href="/dashboard/configuracion?tab=professionals" className="font-medium underline">
            Configuración › Profesionales
          </Link>
          .
        </p>
      ) : (
        <NewLiquidationForm
          professionals={professionals.map((p) => ({
            id: p.id,
            label: `${p.title} ${p.name}`,
            commissionPercent: p.commissionPercent,
          }))}
          defaultFrom={toLocalDateString(first)}
          defaultTo={toLocalDateString(last)}
        />
      )}
    </div>
  );
}
