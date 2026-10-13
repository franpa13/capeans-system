"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, FileText, Pencil, Trash2, X } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTime, toLocalDateString } from "@/features/clinic/lib/format";
import { deleteConsultationAction } from "@/features/consultations/actions";
import { EditConsultationDialog } from "@/features/consultations/components/edit-consultation-dialog";
import { ViewConsultationDialog } from "@/features/consultations/components/view-consultation-dialog";
import type { Consultation, Patient } from "@prisma/client";

export function ConsultationsTable({
  consultations,
  patients,
  treatmentOptions,
  treatmentPrices,
  showPatient = true,
  fixedPatientName,
  emptyMessage = "Todavía no hay consultas registradas.",
}: {
  consultations: Consultation[];
  patients?: Patient[];
  treatmentOptions: string[];
  treatmentPrices: Record<string, number>;
  showPatient?: boolean;
  fixedPatientName?: string;
  emptyMessage?: string;
}) {
  const [viewing, setViewing] = useState<Consultation | null>(null);
  const [editing, setEditing] = useState<Consultation | null>(null);
  const [deleting, setDeleting] = useState<Consultation | null>(null);

  const patientName = (id: string) =>
    fixedPatientName ?? patients?.find((p) => p.id === id)?.name ?? "Paciente eliminado";

  const nameFor = (c: Consultation) =>
    c.patientId ? patientName(c.patientId) : "Paciente eliminado";

  const handleDelete = async () => {
    if (!deleting) return;
    await deleteConsultationAction(deleting.id);
    setDeleting(null);
  };

  const actions = (c: Consultation) => (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Ver consulta"
        onClick={() => setViewing(c)}
      >
        <Eye />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Editar consulta"
        onClick={() => setEditing(c)}
      >
        <Pencil />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Eliminar consulta"
        className="text-destructive hover:text-destructive"
        onClick={() => setDeleting(c)}
      >
        <Trash2 />
      </Button>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      {consultations.length === 0 ? (
        <div className="rounded-lg border p-8">
          <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
            <FileText className="size-5" />
            {emptyMessage}
          </div>
        </div>
      ) : (
        <>
          {/* Below sm, a table forces side-scrolling to reach Acciones —
          cards stack every field instead, each full width and readable
          without scrolling sideways. */}
          <div className="hidden rounded-lg border sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  {showPatient && <TableHead>Paciente</TableHead>}
                  <TableHead>Tratamiento</TableHead>
                  <TableHead>Pieza</TableHead>
                  <TableHead>Observaciones</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consultations.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(toLocalDateString(c.date))} {formatTime(c.date)}
                    </TableCell>
                    {showPatient && (
                      <TableCell className="font-medium">
                        {c.patientId ? (
                          <Link
                            href={`/dashboard/pacientes/${c.patientId}`}
                            className="hover:underline"
                          >
                            {patientName(c.patientId)}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">Paciente eliminado</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {c.treatment}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.teeth.length > 0 ? c.teeth.join(", ") : "—"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {c.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">{actions(c)}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 sm:hidden">
            {consultations.map((c) => (
              <Card key={c.id}>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-muted-foreground">
                        {formatDate(toLocalDateString(c.date))} {formatTime(c.date)}
                      </span>
                      {showPatient &&
                        (c.patientId ? (
                          <Link
                            href={`/dashboard/pacientes/${c.patientId}`}
                            className="font-medium hover:underline"
                          >
                            {patientName(c.patientId)}
                          </Link>
                        ) : (
                          <span className="font-medium text-muted-foreground">
                            Paciente eliminado
                          </span>
                        ))}
                    </div>
                    <Badge variant="secondary" className="shrink-0 font-normal">
                      {c.treatment}
                    </Badge>
                  </div>

                  <div className="flex flex-col gap-1 text-sm">
                    <p className="text-muted-foreground">
                      Pieza: {c.teeth.length > 0 ? c.teeth.join(", ") : "—"}
                    </p>
                    <p className="text-muted-foreground">Observaciones: {c.notes ?? "—"}</p>
                  </div>

                  <div className="flex justify-end gap-1 border-t pt-2">{actions(c)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {viewing && (
        <ViewConsultationDialog
          key={`view-${viewing.id}`}
          consultation={viewing}
          patientName={nameFor(viewing)}
          open
          onOpenChange={(next) => {
            if (!next) setViewing(null);
          }}
          onEdit={() => {
            setEditing(viewing);
            setViewing(null);
          }}
        />
      )}

      {editing && (
        <EditConsultationDialog
          key={`edit-${editing.id}`}
          consultation={editing}
          patientName={nameFor(editing)}
          treatmentOptions={treatmentOptions}
          treatmentPrices={treatmentPrices}
          open
          onOpenChange={(next) => {
            if (!next) setEditing(null);
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(next) => !next && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4 text-destructive" />
              ¿Eliminar esta consulta?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El registro de esta visita
              {deleting ? ` para ${nameFor(deleting)}` : ""} se va a borrar
              por completo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X />
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive! text-white! hover:bg-destructive/90!"
            >
              <Trash2 />
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
