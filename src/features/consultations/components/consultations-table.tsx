"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/features/clinic/lib/format";
import { EditConsultationDialog } from "@/features/consultations/components/edit-consultation-dialog";
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
  const [editing, setEditing] = useState<Consultation | null>(null);

  const patientName = (id: string) =>
    fixedPatientName ?? patients?.find((p) => p.id === id)?.name ?? "Paciente eliminado";

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
          </TableRow>
        </TableHeader>
        <TableBody>
          {consultations.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={showPatient ? 5 : 4}
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
              <TableRow
                key={c.id}
                className="cursor-pointer"
                onClick={() => setEditing(c)}
              >
                <TableCell className="whitespace-nowrap">
                  {formatDate(c.date.toISOString().slice(0, 10))}
                </TableCell>
                {showPatient && (
                  <TableCell className="font-medium">
                    {c.patientId ? (
                      <Link
                        href={`/dashboard/pacientes/${c.patientId}`}
                        className="hover:underline"
                        onClick={(e) => e.stopPropagation()}
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
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {editing && (
        <EditConsultationDialog
          key={editing.id}
          consultation={editing}
          patientName={editing.patientId ? patientName(editing.patientId) : "Paciente eliminado"}
          treatmentOptions={treatmentOptions}
          open
          onOpenChange={(next) => {
            if (!next) setEditing(null);
          }}
        />
      )}
    </div>
  );
}
