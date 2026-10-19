"use client";

import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InsuranceField } from "@/features/clinic/components/insurance-field";
import { MEDICAL_CONDITIONS } from "@/features/clinic/lib/medical";
import type { PatientValues } from "@/features/patients/lib/schema";

export function PatientFormFields({
  register,
  control,
  errors,
  insuranceOptions,
}: {
  register: UseFormRegister<PatientValues>;
  control: Control<PatientValues>;
  errors: FieldErrors<PatientValues>;
  insuranceOptions: string[];
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
                options={insuranceOptions}
              />
            )}
          />
        )}
      />

      <div className="space-y-2">
        <Label htmlFor="insuranceNumber">N° de afiliado</Label>
        <Input id="insuranceNumber" placeholder="Ej: 123456/01" {...register("insuranceNumber")} />
      </div>

      <fieldset className="space-y-3 rounded-md border p-3 sm:col-span-2">
        <legend className="px-1 text-sm font-medium">Antecedentes médicos</legend>

        <div className="space-y-2">
          <Label htmlFor="allergies">Alergias</Label>
          <Input
            id="allergies"
            placeholder="Ej: penicilina, látex"
            {...register("allergies")}
          />
        </div>

        <Controller
          control={control}
          name="medicalConditions"
          render={({ field }) => (
            <div className="grid gap-2 sm:grid-cols-2">
              {MEDICAL_CONDITIONS.map((condition) => {
                const checked = field.value.includes(condition.value);
                return (
                  <label
                    key={condition.value}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={checked}
                      onChange={() =>
                        field.onChange(
                          checked
                            ? field.value.filter((v) => v !== condition.value)
                            : [...field.value, condition.value],
                        )
                      }
                    />
                    {condition.label}
                  </label>
                );
              })}
            </div>
          )}
        />

        <div className="space-y-2">
          <Label htmlFor="medications">Medicación habitual</Label>
          <Input
            id="medications"
            placeholder="Ej: Sintrom 4mg, Enalapril"
            {...register("medications")}
          />
        </div>
      </fieldset>
    </div>
  );
}
