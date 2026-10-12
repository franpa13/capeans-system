"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    if (open) reset(toFormValues(patient, insuranceOptions));
  }, [open, patient, insuranceOptions, reset]);

  const onSubmit = async (values: PatientValues) => {
    await updatePatientAction(patient.id, {
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
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
