"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, type Control, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HeartPulse, IdCard, Save, StickyNote, X } from "lucide-react";
import type { Patient } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InsuranceField } from "@/features/clinic/components/insurance-field";
import { MEDICAL_CONDITIONS } from "@/features/clinic/lib/medical";
import { createPatientAction, updatePatientAction } from "@/features/patients/actions";
import {
  BLOOD_TYPES,
  GENDERS,
  IVA_CONDITIONS,
  REFERRAL_SOURCES,
} from "@/features/patients/lib/options";
import {
  EMPTY_PATIENT_VALUES,
  patientSchema,
  patientToValues,
  toPatientInput,
  type PatientValues,
} from "@/features/patients/lib/schema";
import { unwrap } from "@/lib/action-result";

type FieldName = keyof PatientValues;

/** Which tab each required field lives on, to jump to it on an error. */
const FIELD_TAB: Partial<Record<FieldName, Tab>> = {
  firstName: "personal",
  lastName: "personal",
  phone: "personal",
  email: "personal",
  insuranceOther: "personal",
};
type Tab = "personal" | "medica" | "notas";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {title} {hint && <span className="font-normal normal-case">({hint})</span>}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function TextField({
  register,
  name,
  label,
  placeholder,
  type = "text",
  error,
  wide,
}: {
  register: UseFormRegister<PatientValues>;
  name: FieldName;
  label: string;
  placeholder?: string;
  type?: string;
  error?: string;
  wide?: boolean;
}) {
  return (
    <div className={`space-y-2 ${wide ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} type={type} placeholder={placeholder} aria-invalid={!!error} {...register(name)} />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function SelectField({
  control,
  name,
  label,
  options,
  placeholder = "Seleccioná (opcional)",
}: {
  control: Control<PatientValues>;
  name: FieldName;
  label: string;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={(field.value as string) || undefined} onValueChange={field.onChange}>
            <SelectTrigger id={name} className="w-full">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );
}

function AreaField({
  register,
  name,
  label,
  placeholder,
}: {
  register: UseFormRegister<PatientValues>;
  name: FieldName;
  label: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2 sm:col-span-2">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} rows={3} placeholder={placeholder} {...register(name)} />
    </div>
  );
}

/** The full patient form, as a page: Datos personales (with obra social,
 * fiscal, contact and emergency sections), Información médica, and Notas y
 * origen. Only nombre, apellido and teléfono are required. */
export function PatientForm({
  patient,
  insuranceOptions,
}: {
  /** Editing this patient; omit to create a new one. */
  patient?: Patient;
  insuranceOptions: string[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("personal");
  const [serverError, setServerError] = useState<string | null>(null);
  const cancelHref = patient ? `/dashboard/pacientes/${patient.id}` : "/dashboard/pacientes";

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PatientValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: patient ? patientToValues(patient, insuranceOptions) : EMPTY_PATIENT_VALUES,
  });
  const err = (name: FieldName) => errors[name]?.message as string | undefined;

  async function onSubmit(values: PatientValues) {
    setServerError(null);
    try {
      const input = toPatientInput(values);
      const saved = patient
        ? await unwrap(updatePatientAction(patient.id, input))
        : await unwrap(createPatientAction(input));
      router.push(`/dashboard/pacientes/${saved.id}`);
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "No se pudo guardar");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit, (invalid) => {
        // The required fields are all on the first tab: show it so the
        // error is visible, instead of a submit that seems to do nothing.
        const first = (Object.keys(invalid) as FieldName[])[0];
        setTab(FIELD_TAB[first] ?? "personal");
      })}
      noValidate
      className="flex flex-col gap-4"
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="personal">
            <IdCard />
            Datos personales
          </TabsTrigger>
          <TabsTrigger value="medica">
            <HeartPulse />
            Información médica
          </TabsTrigger>
          <TabsTrigger value="notas">
            <StickyNote />
            Notas y origen
          </TabsTrigger>
        </TabsList>

        {/* forceMount keeps every tab's fields registered (and their values)
            while another tab is shown. */}
        <TabsContent value="personal" forceMount hidden={tab !== "personal"}>
          <Card>
            <CardContent className="space-y-5">
              <Section title="Datos personales">
                <TextField register={register} name="firstName" label="Nombre *" error={err("firstName")} />
                <TextField register={register} name="lastName" label="Apellido *" error={err("lastName")} />
                <TextField register={register} name="dni" label="DNI" placeholder="30.123.456" />
                <TextField register={register} name="birthDate" label="Fecha de nacimiento" type="date" />
                <SelectField control={control} name="gender" label="Género" options={GENDERS} />
                <div className="space-y-2">
                  <Label htmlFor="active">Estado</Label>
                  <Controller
                    control={control}
                    name="active"
                    render={({ field }) => (
                      <Select
                        value={field.value ? "activo" : "inactivo"}
                        onValueChange={(v) => field.onChange(v === "activo")}
                      >
                        <SelectTrigger id="active" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="activo">Activo</SelectItem>
                          <SelectItem value="inactivo">Inactivo (ya no se atiende)</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </Section>

              <Section title="Obra social">
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
                          error={err("insurance")}
                          otherError={err("insuranceOther")}
                          options={insuranceOptions}
                        />
                      )}
                    />
                  )}
                />
                <TextField register={register} name="insurancePlan" label="Plan" placeholder="Ej: 210" />
                <TextField register={register} name="insuranceNumber" label="N° de afiliado" placeholder="Ej: 123456/01" />
                <TextField
                  register={register}
                  name="insuranceHolder"
                  label="Titular (si no es el paciente)"
                />
                <TextField register={register} name="familyGroup" label="Grupo familiar" />
                <TextField
                  register={register}
                  name="holderRelationship"
                  label="Parentesco con el titular"
                  placeholder="Hijo/a, cónyuge..."
                />
                <TextField register={register} name="holderWorkplace" label="Lugar de trabajo del titular" />
              </Section>

              <Section title="Datos fiscales" hint="opcionales, para facturar">
                <TextField register={register} name="taxId" label="CUIT / CUIL" placeholder="20-12345678-9" />
                <TextField
                  register={register}
                  name="taxName"
                  label="Razón social"
                  placeholder="Si es distinta del nombre del paciente"
                />
                <SelectField
                  control={control}
                  name="ivaCondition"
                  label="Condición frente al IVA"
                  options={IVA_CONDITIONS}
                  placeholder="Consumidor final (por defecto)"
                />
              </Section>

              <Section title="Contacto y dirección">
                <TextField
                  register={register}
                  name="phone"
                  label="Teléfono / WhatsApp *"
                  placeholder="11 4455-0000"
                  error={err("phone")}
                />
                <TextField
                  register={register}
                  name="email"
                  label="Email"
                  type="email"
                  placeholder="paciente@email.com"
                  error={err("email")}
                />
                <TextField register={register} name="address" label="Dirección" placeholder="Av. Corrientes 1234" wide />
                <TextField register={register} name="city" label="Ciudad" />
                <TextField register={register} name="province" label="Provincia" />
              </Section>

              <Section title="Contacto de emergencia">
                <TextField register={register} name="emergencyName" label="Nombre" />
                <TextField register={register} name="emergencyPhone" label="Teléfono" />
                <TextField
                  register={register}
                  name="emergencyRelation"
                  label="Relación"
                  placeholder="Cónyuge, padre/madre..."
                />
              </Section>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medica" forceMount hidden={tab !== "medica"}>
          <Card>
            <CardContent className="space-y-5">
              <Section title="Información médica">
                <SelectField
                  control={control}
                  name="bloodType"
                  label="Grupo sanguíneo"
                  options={BLOOD_TYPES.map((t) => ({ value: t, label: t }))}
                />
                <TextField register={register} name="bloodPressure" label="Presión arterial habitual" placeholder="120/80" />
                <TextField register={register} name="allergies" label="Alergias" placeholder="Ej: penicilina, látex" wide />
                <div className="space-y-2 sm:col-span-2">
                  <Label>Condiciones</Label>
                  <Controller
                    control={control}
                    name="medicalConditions"
                    render={({ field }) => (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {MEDICAL_CONDITIONS.map((condition) => {
                          const checked = field.value.includes(condition.value);
                          return (
                            <label key={condition.value} className="flex cursor-pointer items-center gap-2 text-sm">
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
                </div>
                <AreaField register={register} name="medications" label="Medicación habitual" placeholder="Ej: Sintrom 4mg, Enalapril" />
                <AreaField
                  register={register}
                  name="medicalHistory"
                  label="Antecedentes médicos"
                  placeholder="Operaciones, enfermedades, tratamientos anteriores..."
                />
              </Section>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notas" forceMount hidden={tab !== "notas"}>
          <Card>
            <CardContent className="space-y-5">
              <Section title="Notas y origen">
                <SelectField
                  control={control}
                  name="referralSource"
                  label="¿Cómo llegó al consultorio?"
                  options={REFERRAL_SOURCES}
                />
                <Controller
                  control={control}
                  name="acceptsReminders"
                  render={({ field }) => (
                    <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                      Acepta recordatorios por WhatsApp
                    </label>
                  )}
                />
                <AreaField
                  register={register}
                  name="internalNotes"
                  label="Notas internas"
                  placeholder="Notas solo para el consultorio..."
                />
              </Section>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link href={cancelHref}>
            <X />
            Cancelar
          </Link>
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          <Save />
          {isSubmitting ? "Guardando..." : patient ? "Guardar cambios" : "Crear paciente"}
        </Button>
      </div>
    </form>
  );
}
