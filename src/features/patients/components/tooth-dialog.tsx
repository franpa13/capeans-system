"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { Consultation } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ToothHistoryEntry } from "@/features/clinic/components/tooth-chart-3d";
import { formatDate, toLocalDateString } from "@/features/clinic/lib/format";
import {
  CONDITIONS,
  CONDITION_KEYS,
  SURFACES,
  findingLabel,
  isSurfaceCondition,
  surfaceLabel,
  type FindingCondition,
  type FindingStatus,
  type Surface,
} from "@/features/clinic/lib/findings";
import {
  addToothFindingsAction,
  deleteToothFindingAction,
  setToothFindingStatusAction,
} from "@/features/patients/actions";
import { STATUS_COLOR, type FindingView } from "@/features/patients/components/odontogram-2d";
import { unwrap } from "@/lib/action-result";

export function StatusBadge({ status, condition }: { status: FindingStatus; condition: string }) {
  if (condition === "ausente") {
    return <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Ausente</span>;
  }
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: STATUS_COLOR[status] }}
    >
      {status === "PENDING" ? "A realizar" : "Realizado"}
    </span>
  );
}

/** Everything about one tooth: its hallazgos (mark done, delete), a form
 * to chart a new one, and the consultas that treated it. */
export function ToothDialog({
  patientId,
  tooth,
  findings,
  history,
  consultationsById,
  onViewConsultation,
  onOpenChange,
}: {
  patientId: string;
  tooth: string;
  findings: FindingView[];
  history: ToothHistoryEntry[];
  consultationsById: Map<string, Consultation>;
  onViewConsultation: (c: Consultation) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [condition, setCondition] = useState<FindingCondition>("caries");
  const [surfaces, setSurfaces] = useState<Surface[]>([]);
  const [status, setStatus] = useState<FindingStatus>(CONDITIONS.caries.defaultStatus);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const perSurface = isSurfaceCondition(condition);

  function chooseCondition(next: FindingCondition) {
    setCondition(next);
    setStatus(CONDITIONS[next].defaultStatus);
    setError(null);
  }

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    }
  }

  async function add() {
    setSaving(true);
    await run(async () => {
      await unwrap(
        addToothFindingsAction(patientId, {
          tooth,
          condition,
          surfaces: perSurface ? surfaces : undefined,
          status,
          notes,
        }),
      );
      setSurfaces([]);
      setNotes("");
    });
    setSaving(false);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Pieza {tooth}</DialogTitle>
          <DialogDescription>
            Anotá lo que encontraste: en rojo lo que hay que hacer, en azul lo que ya está hecho.
          </DialogDescription>
        </DialogHeader>

        {findings.length > 0 && (
          <section aria-label="Hallazgos de la pieza" className="space-y-2">
            <h3 className="text-sm font-semibold">Hallazgos</h3>
            <ul className="divide-y rounded-md border">
              {findings.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {findingLabel(f)}
                      <StatusBadge status={f.status} condition={f.condition} />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(toLocalDateString(f.createdAt))}
                      {f.authorName && ` · ${f.authorName}`}
                      {f.notes && ` · ${f.notes}`}
                    </p>
                  </div>
                  {f.condition !== "ausente" &&
                    (f.status === "PENDING" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => run(() => unwrap(setToothFindingStatusAction(patientId, f.id, "DONE")))}
                      >
                        <Check />
                        Marcar realizado
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => run(() => unwrap(setToothFindingStatusAction(patientId, f.id, "PENDING")))}
                      >
                        <RotateCcw />
                        Volver a pendiente
                      </Button>
                    ))}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 text-muted-foreground"
                    aria-label={`Borrar ${findingLabel(f)}`}
                    onClick={() => run(() => unwrap(deleteToothFindingAction(patientId, f.id)))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-label="Agregar hallazgo" className="space-y-3 rounded-md border p-3">
          <h3 className="text-sm font-semibold">Agregar hallazgo</h3>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Hallazgo">
            {CONDITION_KEYS.map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={condition === key ? "default" : "outline"}
                aria-pressed={condition === key}
                onClick={() => chooseCondition(key)}
              >
                {CONDITIONS[key].label}
              </Button>
            ))}
          </div>

          {perSurface && (
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">Caras</p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Caras">
                {SURFACES.map((s) => {
                  const on = surfaces.includes(s);
                  return (
                    <Button
                      key={s}
                      type="button"
                      size="sm"
                      variant={on ? "secondary" : "outline"}
                      aria-pressed={on}
                      className={on ? "ring-2 ring-primary" : ""}
                      onClick={() => setSurfaces(on ? surfaces.filter((x) => x !== s) : [...surfaces, s])}
                    >
                      {surfaceLabel(tooth, s)}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {condition !== "ausente" && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Estado">
              {(
                [
                  ["PENDING", "A realizar"],
                  ["DONE", "Ya está hecho"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={status === value}
                  onClick={() => setStatus(value)}
                  className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                    status === value ? "border-transparent font-semibold text-white" : "hover:bg-accent"
                  }`}
                  style={status === value ? { backgroundColor: STATUS_COLOR[value] } : undefined}
                >
                  <span
                    className="size-2.5 rounded-sm"
                    style={{ backgroundColor: status === value ? "white" : STATUS_COLOR[value] }}
                  />
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="findingNotes">Nota (opcional)</Label>
            <Input
              id="findingNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: profunda, controlar en 6 meses"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end">
            <Button type="button" onClick={add} disabled={saving || (perSurface && surfaces.length === 0)}>
              <Plus />
              {saving ? "Guardando..." : "Agregar hallazgo"}
            </Button>
          </div>
        </section>

        <section aria-label="Consultas en esta pieza" className="space-y-2">
          <h3 className="text-sm font-semibold">Consultas en esta pieza</h3>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay consultas en esta pieza.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {history.map((entry, i) => {
                const consultation = entry.consultationId
                  ? consultationsById.get(entry.consultationId)
                  : undefined;
                return (
                  <li
                    key={entry.consultationId ?? i}
                    className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 text-sm">
                      <p>
                        <span className="font-semibold tabular-nums">
                          {formatDate(toLocalDateString(entry.date))}
                        </span>{" "}
                        · <span className="font-medium">{entry.treatment}</span>
                      </p>
                      {entry.notes && <p className="text-muted-foreground">{entry.notes}</p>}
                    </div>
                    {consultation && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="shrink-0 self-start sm:self-auto"
                        onClick={() => onViewConsultation(consultation)}
                      >
                        <Eye />
                        Ver consulta
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
