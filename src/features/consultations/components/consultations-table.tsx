"use client";

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
import type { Consultation, Patient } from "@prisma/client";

export function ConsultationsTable({
  consultations,
  patients,
  showPatient = true,
  emptyMessage = "Todavía no hay consultas registradas.",
}: {
  consultations: Consultation[];
  patients?: Patient[];
  showPatient?: boolean;
  emptyMessage?: string;
}) {
  const patientName = (id: string) =>
    patients?.find((p) => p.id === id)?.name ?? "Paciente eliminado";

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
              <TableRow key={c.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDate(c.date.toISOString().slice(0, 10))}
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
                  {c.tooth ?? "—"}
                </TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">
                  {c.notes ?? "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
