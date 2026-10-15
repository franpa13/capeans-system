"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NO_INSURANCE, OTHER_INSURANCE } from "@/features/clinic/lib/insurance";
import { PatientFormFields } from "@/features/patients/components/patient-form-fields";
import { patientSchema, type PatientValues } from "@/features/patients/lib/schema";
import { updatePatientAction } from "@/features/patients/actions";
import { unwrap } from "@/lib/action-result";
import type { Patient } from "@prisma/client";

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

function toFormValues(patient: Patient, insuranceOptions: string[]): PatientValues {
  const knownInsurance =
    !patient.insurance ||
    patient.insurance === NO_INSURANCE ||
    insuranceOptions.includes(patient.insurance);

  return {
    name: patient.name,
    phone: patient.phone,
    email: patient.email ?? "",
    dni: patient.dni ?? "",
    birthDate: toDateInputValue(patient.birthDate),
    address: patient.address ?? "",
    insurance: knownInsurance ? patient.insurance ?? "" : OTHER_INSURANCE,
    insuranceOther: knownInsurance ? "" : (patient.insurance ?? ""),
    allergies: patient.allergies ?? "",
  };
}

export function EditPatientDialog({
  patient,
  open,
  onOpenChange,
  insuranceOptions,
}: {
  patient: Patient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insuranceOptions: string[];
}) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<PatientValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: toFormValues(patient, insuranceOptions),
  });
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (open) reset(toFormValues(patient, insuranceOptions));
  }, [open, patient, insuranceOptions, reset]);

  const save = async (values: PatientValues) => {
    await unwrap(updatePatientAction(patient.id, {
      name: values.name,
      phone: values.phone,
      email: values.email || undefined,
      dni: values.dni || undefined,
      birthDate: values.birthDate ? new Date(values.birthDate) : undefined,
      address: values.address || undefined,
      insurance:
        values.insurance === OTHER_INSURANCE
          ? values.insuranceOther?.trim()
          : values.insurance || undefined,
      allergies: values.allergies || undefined,
    }));
    onOpenChange(false);
  };

  /** Shows a server-side refusal (e.g. "Lo pagado no puede superar el
   * monto a cobrar") inside the dialog instead of failing silently. */
  const onSubmit = async (values: PatientValues) => {
    setServerError(null);
    try {
      await save(values);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "No se pudo guardar");
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setServerError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="size-4 text-primary" />
              Editar paciente
            </DialogTitle>
            <DialogDescription>
              Actualizá los datos de {patient.name}.
            </DialogDescription>
          </DialogHeader>

          <PatientFormFields
            register={register}
            control={control}
            errors={errors}
            insuranceOptions={insuranceOptions}
          />

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <DialogFooter>
            <Button type="submit">
              <Save />
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
