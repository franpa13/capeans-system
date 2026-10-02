"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  appointmentSchema,
  DURATION_OPTIONS,
  type AppointmentValues,
} from "@/features/appointments/lib/schema";
import {
  createAppointmentAction,
  deleteAppointmentAction,
  updateAppointmentAction,
} from "@/features/appointments/actions";
import type { Appointment } from "@prisma/client";

type PatientOption = { id: string; name: string };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Local-time components, not toISOString() (which is UTC) — the form
// reconstructs startsAt via `new Date(`${date}T${time}:00`)`, which the
// JS Date constructor parses as local time. Mixing UTC extraction with
// local reconstruction would drift the displayed time by the browser's
// UTC offset on every edit.
function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeInputValue(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultsFor(appointment?: Appointment, initialStart?: Date): AppointmentValues {
  if (appointment) {
    return {
      patientId: appointment.patientId ?? "",
      date: toDateInputValue(appointment.startsAt),
      time: toTimeInputValue(appointment.startsAt),
      durationMinutes: appointment.durationMinutes,
      reason: appointment.reason ?? "",
      notes: appointment.notes ?? "",
    };
  }
  const start = initialStart ?? new Date();
  return {
    patientId: "",
    date: toDateInputValue(start),
    time: toTimeInputValue(start),
    durationMinutes: 30,
    reason: "",
    notes: "",
  };
}

export function AppointmentDialog({
  open,
  onOpenChange,
  patients,
  appointment,
  initialStart,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: PatientOption[];
  appointment?: Appointment;
  initialStart?: Date;
  onSaved?: () => void;
}) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEditing = !!appointment;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: defaultsFor(appointment, initialStart),
  });

  const onSubmit = async (values: AppointmentValues) => {
    setSubmitError(null);
    const startsAt = new Date(`${values.date}T${values.time}:00`);

    try {
      if (isEditing) {
        await updateAppointmentAction(appointment.id, {
          patientId: values.patientId,
          startsAt,
          durationMinutes: values.durationMinutes,
          reason: values.reason || undefined,
          notes: values.notes || undefined,
        });
      } else {
        await createAppointmentAction({
          patientId: values.patientId,
          startsAt,
          durationMinutes: values.durationMinutes,
          reason: values.reason || undefined,
          notes: values.notes || undefined,
        });
      }
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo guardar el turno",
      );
    }
  };

  const onCancel = async () => {
    if (!appointment) return;
    setSubmitError(null);
    try {
      await updateAppointmentAction(appointment.id, { status: "CANCELLED" });
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo cancelar el turno",
      );
    }
  };

  const onDelete = async () => {
    if (!appointment) return;
    setSubmitError(null);
    try {
      await deleteAppointmentAction(appointment.id);
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo eliminar el turno",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar turno" : "Nuevo turno"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Modificá el horario o los datos del turno."
                : "Agendá un turno para un paciente."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Paciente</Label>
              <Controller
                control={control}
                name="patientId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccioná un paciente" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.patientId && (
                <p className="text-sm text-destructive">{errors.patientId.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="date">Fecha</Label>
                <Input
                  id="date"
                  type="date"
                  aria-invalid={!!errors.date}
                  {...register("date")}
                />
                {errors.date && (
                  <p className="text-sm text-destructive">{errors.date.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Hora</Label>
                <Input
                  id="time"
                  type="time"
                  aria-invalid={!!errors.time}
                  {...register("time")}
                />
                {errors.time && (
                  <p className="text-sm text-destructive">{errors.time.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Duración</Label>
              <Controller
                control={control}
                name="durationMinutes"
                render={({ field }) => (
                  <Select
                    value={String(field.value)}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map((minutes) => (
                        <SelectItem key={minutes} value={String(minutes)}>
                          {minutes} min
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Motivo (opcional)</Label>
              <Input
                id="reason"
                placeholder="Ej: Control, limpieza, urgencia..."
                {...register("reason")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observaciones (opcional)</Label>
              <Textarea id="notes" rows={3} {...register("notes")} />
            </div>

            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex gap-2">
              {isEditing && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={onCancel}
                  >
                    Cancelar turno
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={isSubmitting}
                    onClick={onDelete}
                  >
                    Eliminar
                  </Button>
                </>
              )}
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
