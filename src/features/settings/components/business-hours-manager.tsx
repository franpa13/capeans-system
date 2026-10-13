"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, Save, X } from "lucide-react";
import type { BusinessHours } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WEEKDAY_FULL_LABELS } from "@/features/appointments/lib/week";
import { updateBusinessHoursAction } from "@/features/settings/actions";
import type { BusinessHoursInput } from "@/features/clinic/data/business-hours";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;

type Draft = {
  isOpen: boolean;
  openTime1: string;
  closeTime1: string;
  hasSecondShift: boolean;
  openTime2: string;
  closeTime2: string;
};

function toDraft(hours: BusinessHours | undefined): Draft {
  return {
    isOpen: hours?.isOpen ?? true,
    openTime1: hours?.openTime1 ?? "09:00",
    closeTime1: hours?.closeTime1 ?? "18:00",
    hasSecondShift: !!(hours?.openTime2 && hours?.closeTime2),
    openTime2: hours?.openTime2 ?? "15:00",
    closeTime2: hours?.closeTime2 ?? "19:00",
  };
}

export function BusinessHoursManager({ hours }: { hours: BusinessHours[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() =>
    Object.fromEntries(
      WEEKDAYS.map((weekday) => [
        weekday,
        toDraft(hours.find((h) => h.weekday === weekday)),
      ]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function patch(weekday: number, changes: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [weekday]: { ...prev[weekday], ...changes } }));
  }

  function toInput(draft: Draft): BusinessHoursInput {
    return {
      isOpen: draft.isOpen,
      openTime1: draft.isOpen ? draft.openTime1 : null,
      closeTime1: draft.isOpen ? draft.closeTime1 : null,
      openTime2: draft.isOpen && draft.hasSecondShift ? draft.openTime2 : null,
      closeTime2: draft.isOpen && draft.hasSecondShift ? draft.closeTime2 : null,
    };
  }

  /** Copies one day's schedule (open/closed, both shifts) onto every
   * other day's draft — a dentist with a uniform week otherwise has to
   * re-enter the same hours six times. Stays local until "Guardar
   * cambios", same as any other edit here. */
  function handleApplyToAll(sourceWeekday: number) {
    const source = drafts[sourceWeekday];
    setDrafts((prev) => {
      const next = { ...prev };
      for (const weekday of WEEKDAYS) {
        if (weekday !== sourceWeekday) next[weekday] = { ...source };
      }
      return next;
    });
  }

  /** One save for the whole week instead of seven, so editing several
   * days doesn't mean hunting down a Guardar button per row. */
  async function handleSaveAll() {
    setSaving(true);
    setError("");
    try {
      await Promise.all(
        WEEKDAYS.map((weekday) => updateBusinessHoursAction(weekday, toInput(drafts[weekday]))),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Horario de atención</CardTitle>
        <CardDescription>
          Se usa para marcar el horario del consultorio en la grilla de Turnos.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {WEEKDAYS.map((weekday) => {
          const draft = drafts[weekday];
          return (
            <div key={weekday} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-24 shrink-0 text-sm font-medium">
                  {WEEKDAY_FULL_LABELS[weekday]}
                </span>

                <div className="flex items-center gap-2">
                  <Switch
                    id={`open-${weekday}`}
                    aria-label={`Abrir o cerrar ${WEEKDAY_FULL_LABELS[weekday]}`}
                    checked={draft.isOpen}
                    onCheckedChange={(checked) => patch(weekday, { isOpen: checked })}
                  />
                  <Label htmlFor={`open-${weekday}`} className="text-sm text-muted-foreground">
                    {draft.isOpen ? "Abierto" : "Cerrado"}
                  </Label>
                </div>

                {draft.isOpen && (
                  <>
                    <div className="flex items-center gap-2">
                      {draft.hasSecondShift && (
                        <span className="text-xs font-medium text-muted-foreground">
                          Mañana
                        </span>
                      )}
                      <Input
                        type="time"
                        aria-label={`Entrada ${WEEKDAY_FULL_LABELS[weekday]}`}
                        value={draft.openTime1}
                        onChange={(e) => patch(weekday, { openTime1: e.target.value })}
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">a</span>
                      <Input
                        type="time"
                        aria-label={`Salida ${WEEKDAY_FULL_LABELS[weekday]}`}
                        value={draft.closeTime1}
                        onChange={(e) => patch(weekday, { closeTime1: e.target.value })}
                        className="w-32"
                      />
                    </div>

                    {!draft.hasSecondShift ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Agregar segundo turno ${WEEKDAY_FULL_LABELS[weekday]}`}
                        onClick={() => patch(weekday, { hasSecondShift: true })}
                      >
                        <Plus />
                        Agregar segundo turno
                      </Button>
                    ) : (
                      <>
                        <Separator orientation="vertical" className="h-6" />
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Tarde
                          </span>
                          <Input
                            type="time"
                            aria-label={`Entrada turno tarde ${WEEKDAY_FULL_LABELS[weekday]}`}
                            value={draft.openTime2}
                            onChange={(e) => patch(weekday, { openTime2: e.target.value })}
                            className="w-32"
                          />
                          <span className="text-sm text-muted-foreground">a</span>
                          <Input
                            type="time"
                            aria-label={`Salida turno tarde ${WEEKDAY_FULL_LABELS[weekday]}`}
                            value={draft.closeTime2}
                            onChange={(e) => patch(weekday, { closeTime2: e.target.value })}
                            className="w-32"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Quitar segundo turno ${WEEKDAY_FULL_LABELS[weekday]}`}
                            onClick={() => patch(weekday, { hasSecondShift: false })}
                          >
                            <X />
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                )}

                <div className="ml-auto flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Aplicar horario de ${WEEKDAY_FULL_LABELS[weekday]} a todos los días`}
                    onClick={() => handleApplyToAll(weekday)}
                  >
                    <Copy />
                    Aplicar a todas
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        <div className="flex flex-col items-end gap-2 border-t pt-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="button" disabled={saving} onClick={handleSaveAll}>
            <Save />
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
