"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { TeethField, type DentitionMode } from "@/features/clinic/components/teeth-field";
import { ToothChart3D, type ToothHistory } from "@/features/clinic/components/tooth-chart-3d";
import { combineDateAndTime, toLocalDateString } from "@/features/clinic/lib/format";
import { OTHER_TREATMENT } from "@/features/clinic/lib/treatments";
import { OTHER_INSURANCE } from "@/features/clinic/lib/insurance";
import { createConsultationAction } from "@/features/consultations/actions";
import {
  consultationSchema,
  NEW_PATIENT_VALUE,
  type ConsultationValues,
} from "@/features/consultations/lib/schema";

type PatientOption = { id: string; name: string };

function todayISO() {
  // Not toISOString().slice(0, 10): that reads the UTC date, which is
  // already tomorrow for anyone in Argentina (UTC-3) past 21:00 local.
  return toLocalDateString(new Date());
}

function nowHHMM() {
  return new Date().toTimeString().slice(0, 5);
}

export function NewConsultationDialog({
  patients = [],
  fixedPatientId,
  fixedPatientName,
  treatmentOptions,
  insuranceOptions = [],
  toothHistory = {},
}: {
  patients?: PatientOption[];
  fixedPatientId?: string;
  fixedPatientName?: string;
  treatmentOptions: string[];
  insuranceOptions?: string[];
  toothHistory?: ToothHistory;
}) {
  const [open, setOpen] = useState(false);
  const [dentitionMode, setDentitionMode] = useState<DentitionMode>("adulto");

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<ConsultationValues>({
    resolver: zodResolver(consultationSchema),
    defaultValues: {
      patientId: fixedPatientId ?? "",
      newPatientName: "",
      newPatientPhone: "",
      newPatientEmail: "",
      newPatientDni: "",
      newPatientBirthDate: "",
      newPatientAddress: "",
      newPatientInsurance: "",
      newPatientInsuranceOther: "",
      newPatientAllergies: "",
      date: todayISO(),
      time: nowHHMM(),
      treatment: "",
      treatmentOther: "",
      teeth: [],
      notes: "",
    },
  });

  const patientId = watch("patientId");
  const treatment = watch("treatment");
  const teeth = watch("teeth") ?? [];
  const isNewPatient = !fixedPatientId && patientId === NEW_PATIENT_VALUE;

  const onSubmit = async (values: ConsultationValues) => {
    const finalPatientId = fixedPatientId ?? values.patientId;

    await createConsultationAction({
      patientId: finalPatientId,
      date: combineDateAndTime(values.date, values.time),
      treatment:
        values.treatment === OTHER_TREATMENT
          ? values.treatmentOther!.trim()
          : values.treatment,
      teeth: values.teeth?.length ? values.teeth : undefined,
      notes: values.notes || undefined,
      newPatient: isNewPatient
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
        : undefined,
    });

    reset({
      patientId: fixedPatientId ?? "",
      newPatientName: "",
      newPatientPhone: "",
      newPatientEmail: "",
      newPatientDni: "",
      newPatientBirthDate: "",
      newPatientAddress: "",
      newPatientInsurance: "",
      newPatientInsuranceOther: "",
      newPatientAllergies: "",
      date: todayISO(),
      time: nowHHMM(),
      treatment: "",
      treatmentOther: "",
      teeth: [],
      notes: "",
    });
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
          Nueva consulta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>Nueva consulta</DialogTitle>
            <DialogDescription>
              Registrá lo que se le hizo al paciente en esta visita.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {fixedPatientId ? (
              <div className="space-y-2">
                <Label>Paciente</Label>
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                  {fixedPatientName}
                </div>
              </div>
            ) : (
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
                  <p className="text-sm text-destructive">
                    {errors.patientId.message}
                  </p>
                )}
              </div>
            )}

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
                  <Input
                    id="newPatientDni"
                    placeholder="30.123.456"
                    {...register("newPatientDni")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPatientBirthDate">Fecha de nacimiento</Label>
                  <Input
                    id="newPatientBirthDate"
                    type="date"
                    {...register("newPatientBirthDate")}
                  />
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
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

            <Card>
              <CardContent className="space-y-4">
                <Controller
                  control={control}
                  name="teeth"
                  render={({ field }) => (
                    <TeethField
                      value={field.value ?? []}
                      onChange={field.onChange}
                      mode={dentitionMode}
                      onModeChange={(mode) => {
                        setDentitionMode(mode);
                        // Per feedback: switching tabs starts the piece
                        // list over, rather than carrying over whatever was
                        // picked under the other dentition.
                        field.onChange([]);
                      }}
                    />
                  )}
                />
                {/* No 3D model for primary (baby) teeth yet — showing the
                    adult odontogram while "Niño" is picked would just be an
                    empty, unrelated mouth. */}
                {dentitionMode === "adulto" && (
                  <ToothChart3D history={toothHistory} selectedTeeth={teeth} />
                )}
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label>Tratamiento realizado</Label>
              <Controller
                control={control}
                name="treatment"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Elegí un tratamiento" />
                    </SelectTrigger>
                    <SelectContent>
                      {treatmentOptions.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                      <SelectItem value={OTHER_TREATMENT}>{OTHER_TREATMENT}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.treatment && (
                <p className="text-sm text-destructive">
                  {errors.treatment.message}
                </p>
              )}
            </div>

            {treatment === OTHER_TREATMENT && (
              <div className="space-y-2">
                <Label htmlFor="treatmentOther">Especificá el tratamiento</Label>
                <Input
                  id="treatmentOther"
                  placeholder="Describí el tratamiento"
                  aria-invalid={!!errors.treatmentOther}
                  {...register("treatmentOther")}
                />
                {errors.treatmentOther && (
                  <p className="text-sm text-destructive">
                    {errors.treatmentOther.message}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Observaciones (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Diagnóstico, indicaciones, próxima cita..."
                rows={3}
                {...register("notes")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
