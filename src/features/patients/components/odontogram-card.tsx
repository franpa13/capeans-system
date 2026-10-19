"use client";

import { useMemo, useState } from "react";
import { Eye } from "lucide-react";
import type { Consultation } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToothChart3D, type ToothHistory } from "@/features/clinic/components/tooth-chart-3d";
import { formatDate, toLocalDateString } from "@/features/clinic/lib/format";
import { ViewConsultationDialog } from "@/features/consultations/components/view-consultation-dialog";

/** The ficha's odontograma: tap a green tooth (or pick its "Pieza" button,
 * easier than aiming in 3D) to list the consultas that treated it — when,
 * what was done, the notes — and open any of them in full. */
export function OdontogramCard({
  history,
  consultations,
  patientName,
}: {
  history: ToothHistory;
  consultations: Consultation[];
  patientName: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Consultation | null>(null);

  const treatedTeeth = useMemo(
    () => Object.keys(history).filter((fdi) => history[fdi].length > 0).sort((a, b) => Number(a) - Number(b)),
    [history],
  );
  const consultationsById = useMemo(
    () => new Map(consultations.map((c) => [c.id, c])),
    [consultations],
  );
  const entries = selected ? (history[selected] ?? []) : [];

  return (
    <section aria-labelledby="odontogram-title">
      <Card>
        <CardHeader>
          <CardTitle id="odontogram-title">Odontograma</CardTitle>
          <CardDescription>
            En verde, los dientes con consultas registradas.{" "}
            {treatedTeeth.length > 0 && "Tocá un diente verde o elegí una pieza para ver su historial."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ToothChart3D
            history={history}
            selectedTeeth={selected ? [selected] : []}
            // The whole mouth stays in view with the tooth in light blue —
            // zooming in on it loses where in the mouth it is.
            autoFocus={false}
            onToothClick={(fdi) => setSelected((current) => (current === fdi ? null : fdi))}
          />

          {treatedTeeth.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {treatedTeeth.map((fdi) => (
                <Button
                  key={fdi}
                  type="button"
                  size="sm"
                  variant={selected === fdi ? "default" : "outline"}
                  aria-pressed={selected === fdi}
                  onClick={() => setSelected(selected === fdi ? null : fdi)}
                >
                  Pieza {fdi}
                </Button>
              ))}
            </div>
          )}

          {selected && (
            <section aria-labelledby="tooth-history-title" className="space-y-2">
              <h3 id="tooth-history-title" className="text-sm font-medium">
                Pieza {selected}
              </h3>
              <ul className="divide-y rounded-md border">
                {entries.map((entry, i) => {
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
                          onClick={() => setViewing(consultation)}
                        >
                          <Eye />
                          Ver consulta
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </CardContent>
      </Card>

      {viewing && (
        <ViewConsultationDialog
          key={viewing.id}
          consultation={viewing}
          patientName={patientName}
          open
          onOpenChange={(open) => !open && setViewing(null)}
        />
      )}
    </section>
  );
}
