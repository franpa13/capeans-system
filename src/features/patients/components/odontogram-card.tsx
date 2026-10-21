"use client";

import { useMemo, useState } from "react";
import { Box, Grid3x3 } from "lucide-react";
import type { Consultation } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToothChart3D, type ToothHistory } from "@/features/clinic/components/tooth-chart-3d";
import { formatDate, toLocalDateString } from "@/features/clinic/lib/format";
import { CONDITIONS, findingCounts, findingLabel, toothStatus } from "@/features/clinic/lib/findings";
import { ViewConsultationDialog } from "@/features/consultations/components/view-consultation-dialog";
import {
  MISSING_COLOR,
  Odontogram2D,
  STATUS_COLOR,
  type Dentition,
  type FindingView,
} from "@/features/patients/components/odontogram-2d";
import { StatusBadge, ToothDialog } from "@/features/patients/components/tooth-dialog";

function Counter({ label, value, hint, color }: { label: string; value: number; hint: string; color: string }) {
  return (
    <Card className="border-l-4" style={{ borderLeftColor: color }}>
      <CardContent className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </CardContent>
    </Card>
  );
}

const isPrimaryTooth = (fdi: string) => Number(fdi[0]) >= 5;

/** The ficha's odontograma: the classic five-face chart where the dentist
 * notes hallazgos (red to do, blue done), with its counters, a legend and
 * their history. Tapping a tooth opens it; the 3D model stays available
 * to show the patient. */
export function OdontogramCard({
  patientId,
  history,
  consultations,
  findings,
  patientName,
}: {
  patientId: string;
  history: ToothHistory;
  consultations: Consultation[];
  findings: FindingView[];
  patientName: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Consultation | null>(null);
  const [show3D, setShow3D] = useState(false);
  // A child's ficha opens on the primary teeth.
  const [dentition, setDentition] = useState<Dentition>(() => {
    const teeth = [...findings.map((f) => f.tooth), ...Object.keys(history)];
    return teeth.length > 0 && teeth.every(isPrimaryTooth) ? "nino" : "adulto";
  });

  const treatedTeeth = useMemo(
    () => new Set(Object.keys(history).filter((fdi) => history[fdi].length > 0)),
    [history],
  );
  const consultationsById = useMemo(
    () => new Map(consultations.map((c) => [c.id, c])),
    [consultations],
  );
  const counts = findingCounts(findings);
  // The 3D model paints whole teeth, so each gets its overall status.
  const toothColors = useMemo(() => {
    const byTooth = new Map<string, FindingView[]>();
    for (const f of findings) byTooth.set(f.tooth, [...(byTooth.get(f.tooth) ?? []), f]);
    const colors: Record<string, string> = {};
    for (const [tooth, list] of byTooth) {
      const status = toothStatus(list);
      if (status) colors[tooth] = status === "MISSING" ? MISSING_COLOR : STATUS_COLOR[status];
    }
    return colors;
  }, [findings]);

  return (
    <section aria-labelledby="odontogram-title" className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Counter
          label="A realizar"
          value={counts.pending}
          hint="Hallazgos pendientes"
          color={STATUS_COLOR.PENDING}
        />
        <Counter
          label="Realizados"
          value={counts.done}
          hint="Tratamientos hechos o existentes"
          color={STATUS_COLOR.DONE}
        />
        <Counter
          label="Piezas ausentes"
          value={counts.missingTeeth}
          hint="Marcadas como ausentes"
          color={MISSING_COLOR}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle id="odontogram-title">Odontograma</CardTitle>
            <CardDescription>Tocá una pieza para anotar hallazgos o ver sus consultas.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1 rounded-md border p-1" role="group" aria-label="Dentición">
              {(
                [
                  ["adulto", "Adulto"],
                  ["nino", "Niño"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={dentition === value ? "secondary" : "ghost"}
                  aria-pressed={dentition === value}
                  onClick={() => setDentition(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setShow3D(!show3D)}>
              {show3D ? <Grid3x3 /> : <Box />}
              {show3D ? "Ver odontograma" : "Ver en 3D"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {show3D ? (
            <ToothChart3D
              history={history}
              selectedTeeth={selected ? [selected] : []}
              autoFocus={false}
              toothColors={toothColors}
              onToothClick={(fdi) => setSelected(fdi)}
            />
          ) : (
            <Odontogram2D
              findings={findings}
              treatedTeeth={treatedTeeth}
              dentition={dentition}
              selected={selected}
              onSelect={setSelected}
            />
          )}

          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm" style={{ backgroundColor: STATUS_COLOR.PENDING }} />A realizar
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm" style={{ backgroundColor: STATUS_COLOR.DONE }} />
              Realizado / existente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              Con consultas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm" style={{ backgroundColor: MISSING_COLOR }} />
              Ausente
            </span>
            {Object.values(CONDITIONS)
              .filter((c) => c.mark && c.mark !== "—")
              .map((c) => (
                <span key={c.label}>
                  <span className="font-bold text-foreground">{c.mark}</span> {c.label}
                </span>
              ))}
            <span>
              <span className="font-bold text-foreground">◯</span> Corona
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de hallazgos</CardTitle>
        </CardHeader>
        <CardContent>
          {findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no se anotaron hallazgos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Pieza</TableHead>
                  <TableHead>Hallazgo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Cargó</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {findings.map((f) => (
                  <TableRow key={f.id} className="cursor-pointer" onClick={() => setSelected(f.tooth)}>
                    <TableCell className="tabular-nums">{formatDate(toLocalDateString(f.createdAt))}</TableCell>
                    <TableCell className="font-semibold tabular-nums">{f.tooth}</TableCell>
                    <TableCell>
                      {findingLabel(f)}
                      {f.notes && <span className="block text-xs text-muted-foreground">{f.notes}</span>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={f.status} condition={f.condition} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{f.authorName ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected && (
        <ToothDialog
          key={selected}
          patientId={patientId}
          tooth={selected}
          findings={findings.filter((f) => f.tooth === selected)}
          history={history[selected] ?? []}
          consultationsById={consultationsById}
          onViewConsultation={setViewing}
          onOpenChange={(open) => !open && setSelected(null)}
        />
      )}

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
