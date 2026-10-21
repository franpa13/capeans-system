import Link from "next/link";
import { Eye, Pill } from "lucide-react";

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
import { formatDate, toLocalDateString } from "@/features/clinic/lib/format";
import { prescriptionNumber, type PrescriptionItem } from "@/features/clinic/lib/prescriptions";
import {
  NewPrescriptionDialog,
  type ProfessionalOption,
} from "@/features/prescriptions/components/new-prescription-dialog";

export type PrescriptionListItem = {
  id: string;
  number: number;
  date: Date;
  professionalTitle: string;
  professionalName: string;
  items: PrescriptionItem[];
};

/** The ficha's "Recetas": every receta issued to the patient, and a new one. */
export function PatientPrescriptions({
  patientId,
  patientName,
  prescriptions,
  professionals,
  treatments,
  medicalHistory,
}: {
  patientId: string;
  patientName: string;
  prescriptions: PrescriptionListItem[];
  professionals: ProfessionalOption[];
  treatments: string[];
  medicalHistory: { allergies: string | null; medicalConditions: string[] };
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Recetas</CardTitle>
          <CardDescription>Para imprimir o mandar por WhatsApp.</CardDescription>
        </div>
        <NewPrescriptionDialog
          patientId={patientId}
          patientName={patientName}
          professionals={professionals}
          treatments={treatments}
          medicalHistory={medicalHistory}
        />
      </CardHeader>
      <CardContent>
        {prescriptions.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Pill className="size-4" />
            Todavía no se le hicieron recetas.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Medicamentos</TableHead>
                <TableHead>Profesional</TableHead>
                <TableHead className="text-right">Ver</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prescriptions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="tabular-nums">{prescriptionNumber(p.number)}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(toLocalDateString(p.date))}</TableCell>
                  <TableCell className="whitespace-normal">
                    {p.items.map((i) => [i.drug, i.concentration].filter(Boolean).join(" ")).join(", ")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.professionalTitle} {p.professionalName}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link
                        href={`/dashboard/pacientes/${patientId}/recetas/${p.id}`}
                        aria-label={`Ver receta ${prescriptionNumber(p.number)}`}
                      >
                        <Eye />
                        Ver
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
