import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/features/clinic/lib/format";

/** Ingresos › "Por profesional": what was collected this month for each
 * one's consultas — the base of their liquidación. */
export function IncomeByProfessional({ rows }: { rows: { name: string; total: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Por profesional</CardTitle>
        <CardDescription>
          Lo cobrado en el mes por las consultas de cada uno. Para calcular su comisión, hacé una{" "}
          <Link href="/dashboard/liquidaciones/nueva" className="font-medium underline">
            liquidación
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul aria-label="Cobrado por profesional" className="space-y-3">
          {rows.map((r) => (
            <li key={r.name} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{r.name}</span>
                <span className="tabular-nums">{formatCurrency(r.total)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${(r.total / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
