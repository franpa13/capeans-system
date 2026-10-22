import { Download, Lock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NoPermission } from "@/components/no-permission";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { hasPermission } from "@/features/clinic/data/current-member";
import { getProfessionals } from "@/features/clinic/data/professionals";
import { formatDate, formatTime, toLocalDateString } from "@/features/clinic/lib/format";
import { APPOINTMENT_STATUS_LABELS } from "@/features/appointments/lib/status";
import { PAYMENT_STATUS_LABELS } from "@/features/clinic/lib/billing";
import { PAYMENT_METHOD_LABELS } from "@/features/clinic/lib/payments";
import { ORDER_KINDS } from "@/features/clinic/lib/orders";
import { EXPORTS, type ExportFilterKey } from "@/features/exports/lib/catalog";
import { getRecentExports } from "@/features/exports/data/build-export";
import { ExportCard, type ChoiceFilter } from "@/features/exports/components/export-card";

const options = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

export default async function ExportacionesPage() {
  if (!(await hasPermission("data.export"))) return <NoPermission what="las exportaciones" />;
  const clinic = (await getCurrentClinic())!;
  const [professionals, recent] = await Promise.all([getProfessionals(clinic.id), getRecentExports(clinic.id)]);

  const CHOICES: Partial<Record<ExportFilterKey, ChoiceFilter>> = {
    professional: {
      param: "profesional",
      label: "Profesional",
      options: professionals.map((p) => ({ value: p.id, label: `${p.title} ${p.name}` })),
    },
    patientStatus: {
      param: "estado",
      label: "Pacientes",
      options: [
        { value: "activos", label: "Activos" },
        { value: "inactivos", label: "Inactivos" },
      ],
    },
    appointmentStatus: { param: "estado", label: "Estado del turno", options: options(APPOINTMENT_STATUS_LABELS) },
    paymentStatus: { param: "estado", label: "Estado del cobro", options: options(PAYMENT_STATUS_LABELS) },
    paymentMethod: { param: "metodo", label: "Medio de pago", options: options(PAYMENT_METHOD_LABELS) },
    findingStatus: {
      param: "estado",
      label: "Estado",
      options: [
        { value: "PENDING", label: "A realizar" },
        { value: "DONE", label: "Realizados" },
      ],
    },
    orderKind: {
      param: "tipo",
      label: "Tipo de orden",
      options: Object.entries(ORDER_KINDS).map(([value, k]) => ({ value, label: k.label })),
    },
  };
  const titleOf = new Map<string, string>(EXPORTS.map((e) => [e.kind, e.title]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Exportaciones"
        description="Descargá los datos del consultorio en Excel (.xlsx)."
        icon={Download}
      />

      <div
        role="note"
        className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
      >
        <Lock className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
        <p>
          <b>Información sensible.</b> Estos archivos tienen datos personales y de salud de los pacientes. Guardalos
          en un lugar seguro y no los compartas por canales no protegidos. Cada descarga queda registrada.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {EXPORTS.map((e) => (
          <ExportCard
            key={e.kind}
            kind={e.kind}
            title={e.title}
            description={e.description}
            sheets={e.sheets}
            filters={e.filters}
            choices={e.filters
              .filter((f) => f !== "period" && !(f === "professional" && professionals.length === 0))
              .map((f) => CHOICES[f]!)}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas descargas</CardTitle>
          <CardDescription>Quién descargó qué, y cuándo.</CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no se descargó nada.</p>
          ) : (
            <ul aria-label="Últimas descargas" className="divide-y rounded-md border">
              {recent.map((log) => (
                <li key={log.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                  <span className="tabular-nums text-muted-foreground">
                    {formatDate(toLocalDateString(log.createdAt))} {formatTime(log.createdAt)}
                  </span>
                  <span className="font-medium">{titleOf.get(log.kind) ?? log.kind}</span>
                  {log.filters && <span className="text-muted-foreground">{log.filters}</span>}
                  <span className="ml-auto text-muted-foreground">{log.memberName}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
