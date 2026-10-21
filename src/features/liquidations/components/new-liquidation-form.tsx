"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LIQUIDATION_MODES,
  type LiquidationLine,
  type LiquidationMode,
} from "@/features/clinic/lib/liquidations";
import { createLiquidationAction, previewLiquidationAction } from "@/features/liquidations/actions";
import { LiquidationLines } from "@/features/liquidations/components/liquidation-lines";
import { unwrap } from "@/lib/action-result";

type ProfessionalOption = { id: string; label: string; commissionPercent: number | null };
type Preview = { lines: LiquidationLine[]; totalCollected: number; totalCommission: number };

/** Nueva liquidación: professional, period and mode → a preview of every
 * consulta's commission → saved as is. */
export function NewLiquidationForm({
  professionals,
  defaultFrom,
  defaultTo,
}: {
  professionals: ProfessionalOption[];
  defaultFrom: string;
  defaultTo: string;
}) {
  const router = useRouter();
  const [professionalId, setProfessionalId] = useState(professionals.length === 1 ? professionals[0].id : "");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [mode, setMode] = useState<LiquidationMode>("PROFESSIONAL");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Any change to the parameters asks for a fresh preview.
  const change = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPreview(null);
    setError(null);
  };
  const input = { professionalId, from, to, mode };

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo calcular");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Parámetros</CardTitle>
          <CardDescription>La comisión se calcula sobre lo cobrado en el período.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="liquidationProfessional">Profesional</Label>
            <Select value={professionalId} onValueChange={change(setProfessionalId)}>
              <SelectTrigger id="liquidationProfessional" className="w-full">
                <SelectValue placeholder="Elegí un profesional" />
              </SelectTrigger>
              <SelectContent>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                    {p.commissionPercent != null ? ` (${p.commissionPercent}% de comisión)` : " (sin % de comisión)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="liquidationFrom">Desde</Label>
              <Input
                id="liquidationFrom"
                type="date"
                value={from}
                onChange={(e) => change(setFrom)(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="liquidationTo">Hasta</Label>
              <Input id="liquidationTo" type="date" value={to} onChange={(e) => change(setTo)(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Modo de cálculo</p>
            <div role="radiogroup" aria-label="Modo de cálculo" className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(LIQUIDATION_MODES) as LiquidationMode[]).map((m) => (
                <label
                  key={m}
                  className={`flex cursor-pointer gap-2 rounded-md border p-3 text-sm ${
                    mode === m ? "border-primary bg-primary/5" : "hover:bg-accent"
                  }`}
                >
                  <input
                    type="radio"
                    name="mode"
                    className="mt-0.5 accent-primary"
                    checked={mode === m}
                    onChange={() => change(setMode)(m)}
                  />
                  <span>
                    <span className="font-medium">{LIQUIDATION_MODES[m].label}</span>
                    <span className="block text-xs text-muted-foreground">{LIQUIDATION_MODES[m].description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div>
            <Button
              type="button"
              disabled={busy || !professionalId}
              onClick={() => run(async () => setPreview(await unwrap(previewLiquidationAction(input))))}
            >
              <Eye />
              Ver vista previa
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle>Vista previa</CardTitle>
              <CardDescription>
                {preview.lines.length === 0
                  ? "No hay cobros de este profesional en ese período."
                  : `${preview.lines.length} ${preview.lines.length === 1 ? "consulta" : "consultas"} con cobros en el período.`}
              </CardDescription>
            </div>
            {preview.lines.length > 0 && (
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const { id } = await unwrap(createLiquidationAction(input));
                    router.push(`/dashboard/liquidaciones/${id}`);
                  })
                }
              >
                <Save />
                Guardar liquidación
              </Button>
            )}
          </CardHeader>
          {preview.lines.length > 0 && (
            <CardContent>
              <LiquidationLines {...preview} />
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
