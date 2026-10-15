"use client";

import Link from "next/link";
import { CalendarDays, Pencil } from "lucide-react";

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
import { formatDate, formatTime, toLocalDateString } from "@/features/clinic/lib/format";
import type { Appointment } from "@prisma/client";
import { ReminderButton } from "@/features/appointments/components/reminder-button";

const STATUS_LABELS: Record<Appointment["status"], string> = {
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  COMPLETED: "Completado",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function ViewAppointmentDialog({
  appointment,
  patientName,
  open,
  onOpenChange,
  onEdit,
  patientPhone,
  clinicName,
}: {
  appointment: Appointment;
  patientName: string;
  /** With clinicName, enables the WhatsApp reminder for a confirmed turno. */
  patientPhone?: string;
  clinicName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            Detalle del turno
          </DialogTitle>
          <DialogDescription>
            {formatDate(toLocalDateString(appointment.startsAt))} — {formatTime(appointment.startsAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 sm:grid-cols-2">
          <Field label="Paciente">
            {appointment.patientId ? (
              <Link
                href={`/dashboard/pacientes/${appointment.patientId}`}
                className="font-medium hover:underline"
              >
                {patientName}
              </Link>
            ) : (
              <span className="text-muted-foreground">{patientName}</span>
            )}
          </Field>

          <Field label="Estado">
            <Badge variant="secondary" className="font-normal">
              {STATUS_LABELS[appointment.status]}
            </Badge>
          </Field>

          <Field label="Duración">{appointment.durationMinutes} min</Field>

          <Field label="Motivo">
            {appointment.reason ? (
              appointment.reason
            ) : (
              <span className="text-muted-foreground">Sin motivo</span>
            )}
          </Field>

          <Field label="Observaciones">
            {appointment.notes ? (
              <p className="whitespace-pre-wrap">{appointment.notes}</p>
            ) : (
              <span className="text-muted-foreground">Sin observaciones</span>
            )}
          </Field>
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          {appointment.status === "CONFIRMED" &&
          appointment.patientId &&
          patientPhone !== undefined &&
          clinicName !== undefined ? (
            <ReminderButton
              appointmentId={appointment.id}
              startsAt={appointment.startsAt}
              reminderSentAt={appointment.reminderSentAt}
              patientName={patientName}
              phone={patientPhone}
              clinicName={clinicName}
            />
          ) : (
            <span />
          )}
          <Button type="button" variant="outline" onClick={onEdit}>
            <Pencil />
            Editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
