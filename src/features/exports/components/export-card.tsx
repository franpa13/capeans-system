"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";

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
import type { ExportFilterKey } from "@/features/exports/lib/catalog";

const ALL = "__all__";

export type ChoiceFilter = { param: string; label: string; options: { value: string; label: string }[] };

/** One Exportaciones card: what's in the file, its filters, and the
 * download — a link to the export route with the filters as params. */
export function ExportCard({
  kind,
  title,
  description,
  sheets,
  filters,
  choices,
}: {
  kind: string;
  title: string;
  description: string;
  sheets: readonly string[];
  filters: readonly ExportFilterKey[];
  /** The select filters this card shows (profesional, estado, …), ready. */
  choices: ChoiceFilter[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const set = (param: string, value: string) => setValues((v) => ({ ...v, [param]: value }));
  const hasPeriod = filters.includes("period");

  const params = new URLSearchParams(
    Object.entries(values).filter(([, v]) => v && v !== ALL),
  ).toString();
  const href = `/api/exportar/${kind}${params ? `?${params}` : ""}`;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <p className="w-fit rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
          Hojas: {sheets.join(" · ")}
        </p>
      </CardHeader>
      <CardContent className="mt-auto flex flex-col gap-3">
        {(hasPeriod || choices.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {hasPeriod && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor={`${kind}-desde`}>Desde</Label>
                  <Input
                    id={`${kind}-desde`}
                    type="date"
                    value={values.desde ?? ""}
                    onChange={(e) => set("desde", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${kind}-hasta`}>Hasta</Label>
                  <Input
                    id={`${kind}-hasta`}
                    type="date"
                    value={values.hasta ?? ""}
                    onChange={(e) => set("hasta", e.target.value)}
                  />
                </div>
              </>
            )}
            {choices.map((choice) => (
              <div key={choice.param} className="space-y-1.5">
                <Label htmlFor={`${kind}-${choice.param}`}>{choice.label}</Label>
                <Select value={values[choice.param] ?? ALL} onValueChange={(v) => set(choice.param, v)}>
                  <SelectTrigger id={`${kind}-${choice.param}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos</SelectItem>
                    {choice.options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <a
              href={href}
              download
              aria-label={`Descargar Excel de ${title}`}
              // The download is recorded: show it in "Últimas descargas".
              onClick={() => setTimeout(() => router.refresh(), 1500)}
            >
              <Download />
              Descargar Excel
            </a>
          </Button>
          <span className="text-xs text-muted-foreground">
            {hasPeriod && !values.desde && !values.hasta
              ? "Sin fechas: incluye todo el historial."
              : !hasPeriod && choices.length === 0
                ? "Incluye todos los registros."
                : null}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
