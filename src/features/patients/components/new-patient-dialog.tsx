"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Save, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { OTHER_INSURANCE } from "@/features/clinic/lib/insurance";
import { PatientFormFields } from "@/features/patients/components/patient-form-fields";
import { patientSchema, type PatientValues } from "@/features/patients/lib/schema";
import { createPatientAction } from "@/features/patients/actions";
import type { Patient } from "@prisma/client";

const emptyValues: PatientValues = {
  name: "",
  phone: "",
  email: "",
  dni: "",
  birthDate: "",
  address: "",
  insurance: "",
  insuranceOther: "",
  allergies: "",
};

export function NewPatientDialog({
  onCreated,
  insuranceOptions,
}: {
  onCreated?: (patient: Patient) => void;
  insuranceOptions: string[];
}) {
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<PatientValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: emptyValues,
  });

  const onSubmit = async (values: PatientValues) => {
    const patient = await createPatientAction({
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
    onCreated?.(patient);
    reset();
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Nuevo paciente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-4 text-primary" />
              Nuevo paciente
            </DialogTitle>
            <DialogDescription>
              Nombre y teléfono son obligatorios, el resto lo podés completar después.
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
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
