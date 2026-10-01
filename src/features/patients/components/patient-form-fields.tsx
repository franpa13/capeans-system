"use client";

import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InsuranceField } from "@/features/clinic/components/insurance-field";
import type { PatientValues } from "@/features/patients/lib/schema";

export function PatientFormFields({
  register,
  control,
  errors,
}: {
  register: UseFormRegister<PatientValues>;
  control: Control<PatientValues>;
  errors: FieldErrors<PatientValues>;
}) {
  return (
    <div className="grid gap-4 py-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          placeholder="Nombre y apellido"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Teléfono</Label>
        <Input
          id="phone"
          placeholder="11 4455-0000"
          aria-invalid={!!errors.phone}
          {...register("phone")}
        />
        {errors.phone && (
          <p className="text-sm text-destructive">{errors.phone.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="paciente@email.com"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="dni">DNI</Label>
        <Input id="dni" placeholder="30.123.456" {...register("dni")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="birthDate">Fecha de nacimiento</Label>
        <Input id="birthDate" type="date" {...register("birthDate")} />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="address">Dirección</Label>
        <Input
          id="address"
          placeholder="Calle 123, CABA"
          {...register("address")}
        />
      </div>

      <Controller
        control={control}
        name="insurance"
        render={({ field }) => (
          <Controller
            control={control}
            name="insuranceOther"
            render={({ field: otherField }) => (
              <InsuranceField
                id="insurance"
                value={field.value}
                onChange={field.onChange}
                otherValue={otherField.value}
                onOtherChange={otherField.onChange}
                error={errors.insurance?.message}
                otherError={errors.insuranceOther?.message}
              />
            )}
          />
        )}
      />

      <div className="space-y-2">
        <Label htmlFor="allergies">Alergias / antecedentes</Label>
        <Input
          id="allergies"
          placeholder="Ej: alergia a penicilina"
          {...register("allergies")}
        />
      </div>
    </div>
  );
}
