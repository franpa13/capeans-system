"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToothChart3D } from "@/features/clinic/components/tooth-chart-3d";
import { formatDate, formatTime, toLocalDateString } from "@/features/clinic/lib/format";
import type { Consultation } from "@prisma/client";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function ViewConsultationDialog({
  consultation,
  patientName,
  open,
  onOpenChange,
  onEdit,
}: {
  consultation: Consultation;
  patientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalle de la consulta</DialogTitle>
          <DialogDescription>
            {formatDate(toLocalDateString(consultation.date))} — {formatTime(consultation.date)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 sm:grid-cols-2">
          <Field label="Paciente">
            {consultation.patientId ? (
              <Link
                href={`/dashboard/pacientes/${consultation.patientId}`}
                className="font-medium hover:underline"
              >
                {patientName}
              </Link>
            ) : (
              <span className="text-muted-foreground">{patientName}</span>
            )}
          </Field>

          <Field label="Tratamiento">
            <Badge variant="secondary" className="font-normal">
              {consultation.treatment}
            </Badge>
          </Field>

          <Field label="Piezas dentales">
            {consultation.teeth.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {consultation.teeth.map((fdi) => (
                  <Badge key={fdi} variant="outline" className="font-normal">
                    {fdi}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">Sin piezas registradas</span>
            )}
          </Field>

          <Field label="Observaciones">
            {consultation.notes ? (
              <p className="whitespace-pre-wrap">{consultation.notes}</p>
            ) : (
              <span className="text-muted-foreground">Sin observaciones</span>
            )}
          </Field>
        </div>

        <ToothChart3D
          className="h-128"
          selectedTeeth={consultation.teeth}
          autoFocus={false}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onEdit}>
            <Pencil />
            Editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
