"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, CalendarX2, CheckCircle2, Save, Trash2, UserPlus } from "lucide-react";

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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { InsuranceField } from "@/features/clinic/components/insurance-field";
import { OTHER_INSURANCE } from "@/features/clinic/lib/insurance";
import {
  appointmentSchema,
  DURATION_OPTIONS,
  NEW_PATIENT_VALUE,
  type AppointmentValues,
} from "@/features/appointments/lib/schema";
import {
  createAppointmentAction,
  deleteAppointmentAction,
  updateAppointmentAction,
} from "@/features/appointments/actions";
import { unwrap } from "@/lib/action-result";
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

const emptyNewPatientFields = {
  newPatientName: "",
  newPatientPhone: "",
  newPatientEmail: "",
  newPatientDni: "",
  newPatientBirthDate: "",
  newPatientAddress: "",
  newPatientInsurance: "",
  newPatientInsuranceOther: "",
  newPatientAllergies: "",
};

function defaultsFor(appointment?: Appointment, initialStart?: Date): AppointmentValues {
  if (appointment) {
    return {
      patientId: appointment.patientId ?? "",
      ...emptyNewPatientFields,
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
    ...emptyNewPatientFields,
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
  insuranceOptions = [],
  onSaved,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: PatientOption[];
  appointment?: Appointment;
  initialStart?: Date;
  insuranceOptions?: string[];
  onSaved?: () => void;
  /** Fired only when this turno is marked completed (not on a regular
   * save or cancel) — lets the caller offer logging the consulta for it. */
  onCompleted?: (appointment: Appointment) => void;
}) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEditing = !!appointment;
  // Completar/cancelar are transitions out of CONFIRMED — offering them
  // on a turno that's already cancelled or completed suggested you could
  // still change its mind for it, which isn't true once it's settled.
  const canChangeStatus = appointment?.status === "CONFIRMED";

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: defaultsFor(appointment, initialStart),
  });

  const patientId = watch("patientId");
  const isNewPatient = patientId === NEW_PATIENT_VALUE;

  const onSubmit = async (values: AppointmentValues) => {
    setSubmitError(null);
    const startsAt = new Date(`${values.date}T${values.time}:00`);
    const newPatient = isNewPatient
      ? {
          name: values.newPatientName!.trim(),
          phone: values.newPatientPhone!.trim(),
          email: values.newPatientEmail || undefined,
          dni: values.newPatientDni || undefined,
          birthDate: values.newPatientBirthDate
            ? new Date(values.newPatientBirthDate)
            : undefined,
          address: values.newPatientAddress || undefined,
          insurance:
            values.newPatientInsurance === OTHER_INSURANCE
              ? values.newPatientInsuranceOther?.trim()
              : values.newPatientInsurance || undefined,
          allergies: values.newPatientAllergies || undefined,
        }
      : undefined;

    try {
      if (isEditing) {
        await unwrap(updateAppointmentAction(appointment.id, {
          patientId: values.patientId,
          startsAt,
          durationMinutes: values.durationMinutes,
          reason: values.reason || undefined,
          notes: values.notes || undefined,
          newPatient,
        }));
      } else {
        await unwrap(createAppointmentAction({
          patientId: values.patientId,
          startsAt,
          durationMinutes: values.durationMinutes,
          reason: values.reason || undefined,
          notes: values.notes || undefined,
          newPatient,
        }));
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
      await unwrap(updateAppointmentAction(appointment.id, { status: "CANCELLED" }));
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo cancelar el turno",
      );
    }
  };

  const onComplete = async () => {
    if (!appointment) return;
    setSubmitError(null);
    try {
      const updated = await unwrap(updateAppointmentAction(appointment.id, { status: "COMPLETED" }));
      onOpenChange(false);
      onSaved?.();
      onCompleted?.(updated);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo completar el turno",
      );
    }
  };

  const onDelete = async () => {
    if (!appointment) return;
    setSubmitError(null);
    try {
      await unwrap(deleteAppointmentAction(appointment.id));
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              {isEditing ? "Editar turno" : "Nuevo turno"}
            </DialogTitle>
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
                      <SelectSeparator />
                      <SelectItem value={NEW_PATIENT_VALUE}>
                        <UserPlus className="size-4" />
                        Agregar paciente nuevo
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.patientId && (
                <p className="text-sm text-destructive">{errors.patientId.message}</p>
              )}
            </div>

            {isNewPatient && (
              <div className="grid gap-4 rounded-md border p-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="newPatientName">Nombre</Label>
                  <Input
                    id="newPatientName"
                    placeholder="Nombre y apellido"
                    aria-invalid={!!errors.newPatientName}
                    {...register("newPatientName")}
                  />
                  {errors.newPatientName && (
                    <p className="text-sm text-destructive">
                      {errors.newPatientName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPatientPhone">Teléfono</Label>
                  <Input
                    id="newPatientPhone"
                    placeholder="11 4455-0000"
                    aria-invalid={!!errors.newPatientPhone}
                    {...register("newPatientPhone")}
                  />
                  {errors.newPatientPhone && (
                    <p className="text-sm text-destructive">
                      {errors.newPatientPhone.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPatientEmail">Email</Label>
                  <Input
                    id="newPatientEmail"
                    type="email"
                    placeholder="paciente@email.com"
                    aria-invalid={!!errors.newPatientEmail}
                    {...register("newPatientEmail")}
                  />
                  {errors.newPatientEmail && (
                    <p className="text-sm text-destructive">
                      {errors.newPatientEmail.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPatientDni">DNI</Label>
                  <Input id="newPatientDni" placeholder="30.123.456" {...register("newPatientDni")} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPatientBirthDate">Fecha de nacimiento</Label>
                  <Input id="newPatientBirthDate" type="date" {...register("newPatientBirthDate")} />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="newPatientAddress">Dirección</Label>
                  <Input
                    id="newPatientAddress"
                    placeholder="Calle 123, CABA"
                    {...register("newPatientAddress")}
                  />
                </div>

                <Controller
                  control={control}
                  name="newPatientInsurance"
                  render={({ field }) => (
                    <Controller
                      control={control}
                      name="newPatientInsuranceOther"
                      render={({ field: otherField }) => (
                        <InsuranceField
                          id="newPatientInsurance"
                          value={field.value}
                          onChange={field.onChange}
                          otherValue={otherField.value}
                          onOtherChange={otherField.onChange}
                          error={errors.newPatientInsurance?.message}
                          otherError={errors.newPatientInsuranceOther?.message}
                          options={insuranceOptions}
                        />
                      )}
                    />
                  )}
                />

                <div className="space-y-2">
                  <Label htmlFor="newPatientAllergies">Alergias / antecedentes</Label>
                  <Input
                    id="newPatientAllergies"
                    placeholder="Ej: alergia a penicilina"
                    {...register("newPatientAllergies")}
                  />
                </div>
              </div>
            )}

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

          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {isEditing && (
                <>
                  {canChangeStatus && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isSubmitting}
                        onClick={onComplete}
                      >
                        <CheckCircle2 />
                        Marcar como completado
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isSubmitting}
                        onClick={onCancel}
                      >
                        <CalendarX2 />
                        Cancelar turno
                      </Button>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={isSubmitting}
                    onClick={onDelete}
                  >
                    <Trash2 />
                    Eliminar
                  </Button>
                </>
              )}
            </div>
            <Button type="submit" disabled={isSubmitting}>
              <Save />
              {isSubmitting ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
