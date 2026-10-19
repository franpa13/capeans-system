"use client";

import Link from "next/link";
import { ClipboardList, Pencil } from "lucide-react";

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
import { formatCurrency, formatDate, formatTime, toLocalDateString } from "@/features/clinic/lib/format";
import { PaymentStatusBadge } from "@/features/consultations/components/payment-status-badge";
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
  /** Omit to show the detail without an Editar button. */
  onEdit?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" />
            Detalle de la consulta
          </DialogTitle>
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

          <Field label="Cobro">
            {consultation.amountCharged != null ? (
              <div className="flex items-center gap-2">
                <PaymentStatusBadge
                  amountCharged={consultation.amountCharged}
                  amountPaid={consultation.amountPaid}
                />
                <span className="text-muted-foreground">
                  {formatCurrency(consultation.amountPaid)} / {formatCurrency(consultation.amountCharged)}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">Sin monto registrado</span>
            )}
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

        {onEdit && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onEdit}>
              <Pencil />
              Editar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
