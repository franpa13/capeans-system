"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, FileText, Pencil, Trash2 } from "lucide-react";

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
  showPatient = true,
  fixedPatientName,
  emptyMessage = "Todavía no hay consultas registradas.",
}: {
  consultations: Consultation[];
  patients?: Patient[];
  treatmentOptions: string[];
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

  return (
    <div className="rounded-lg border">
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
          {consultations.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={showPatient ? 6 : 5}
                className="h-32 text-center text-muted-foreground"
              >
                <div className="flex flex-col items-center gap-2">
                  <FileText className="size-5" />
                  {emptyMessage}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            consultations.map((c) => (
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
                  <div className="flex justify-end gap-1">
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
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

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
          open
          onOpenChange={(next) => {
            if (!next) setEditing(null);
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(next) => !next && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta consulta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El registro de esta visita
              {deleting ? ` para ${nameFor(deleting)}` : ""} se va a borrar
              por completo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive! text-white! hover:bg-destructive/90!"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
