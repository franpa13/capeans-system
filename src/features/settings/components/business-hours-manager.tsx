"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import type { BusinessHours } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const WEEKDAYS = [1, 2, 3, 4, 5, 6] as const;

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
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [errorByDay, setErrorByDay] = useState<Record<number, string>>({});

  function patch(weekday: number, changes: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [weekday]: { ...prev[weekday], ...changes } }));
  }

  async function handleSave(weekday: number) {
    const draft = drafts[weekday];
    setSavingDay(weekday);
    setErrorByDay((prev) => ({ ...prev, [weekday]: "" }));
    try {
      await updateBusinessHoursAction(weekday, {
        isOpen: draft.isOpen,
        openTime1: draft.isOpen ? draft.openTime1 : null,
        closeTime1: draft.isOpen ? draft.closeTime1 : null,
        openTime2: draft.isOpen && draft.hasSecondShift ? draft.openTime2 : null,
        closeTime2: draft.isOpen && draft.hasSecondShift ? draft.closeTime2 : null,
      });
      router.refresh();
    } catch (error) {
      setErrorByDay((prev) => ({
        ...prev,
        [weekday]: error instanceof Error ? error.message : "No se pudo guardar",
      }));
    } finally {
      setSavingDay(null);
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
                      </>
                    )}
                  </>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  aria-label={`Guardar horario ${WEEKDAY_FULL_LABELS[weekday]}`}
                  disabled={savingDay === weekday}
                  onClick={() => handleSave(weekday)}
                >
                  Guardar
                </Button>
              </div>
              {errorByDay[weekday] && (
                <p className="text-sm text-destructive">{errorByDay[weekday]}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
