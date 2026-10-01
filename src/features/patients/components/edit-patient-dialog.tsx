"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { useClinicData } from "@/features/clinic/context/clinic-provider";
import { INSURANCE_OPTIONS, NO_INSURANCE, OTHER_INSURANCE } from "@/features/clinic/lib/insurance";
import { PatientFormFields } from "@/features/patients/components/patient-form-fields";
import { patientSchema, type PatientValues } from "@/features/patients/lib/schema";
import type { Patient } from "@/features/clinic/lib/types";

function toFormValues(patient: Patient): PatientValues {
  const knownInsurance =
    !patient.insurance ||
    patient.insurance === NO_INSURANCE ||
    (INSURANCE_OPTIONS as readonly string[]).includes(patient.insurance);

  return {
    name: patient.name,
    phone: patient.phone,
    email: patient.email ?? "",
    dni: patient.dni ?? "",
    birthDate: patient.birthDate ?? "",
    address: patient.address ?? "",
    insurance: knownInsurance ? patient.insurance ?? "" : OTHER_INSURANCE,
    insuranceOther: knownInsurance ? "" : patient.insurance,
    allergies: patient.allergies ?? "",
  };
}

export function EditPatientDialog({
  patient,
  open,
  onOpenChange,
}: {
  patient: Patient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { editPatient } = useClinicData();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<PatientValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: toFormValues(patient),
  });

  useEffect(() => {
    if (open) reset(toFormValues(patient));
  }, [open, patient, reset]);

  const onSubmit = (values: PatientValues) => {
    editPatient(patient.id, {
      name: values.name,
      phone: values.phone,
      email: values.email || undefined,
      dni: values.dni || undefined,
      birthDate: values.birthDate || undefined,
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>Editar paciente</DialogTitle>
            <DialogDescription>
              Actualizá los datos de {patient.name}.
            </DialogDescription>
          </DialogHeader>

          <PatientFormFields register={register} control={control} errors={errors} />

          <DialogFooter>
            <Button type="submit">Guardar cambios</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
