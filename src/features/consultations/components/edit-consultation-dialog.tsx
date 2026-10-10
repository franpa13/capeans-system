"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TeethField, type DentitionMode } from "@/features/clinic/components/teeth-field";
import { ToothChart3D } from "@/features/clinic/components/tooth-chart-3d";
import { combineDateAndTime, splitDateAndTime } from "@/features/clinic/lib/format";
import { OTHER_TREATMENT } from "@/features/clinic/lib/treatments";
import { updateConsultationAction } from "@/features/consultations/actions";
import { editConsultationSchema, type EditConsultationValues } from "@/features/consultations/lib/schema";
import type { Consultation } from "@prisma/client";

function toFormValues(consultation: Consultation, treatmentOptions: string[]): EditConsultationValues {
  const knownTreatment = treatmentOptions.includes(consultation.treatment);
  return {
    ...splitDateAndTime(consultation.date),
    treatment: knownTreatment ? consultation.treatment : OTHER_TREATMENT,
    treatmentOther: knownTreatment ? "" : consultation.treatment,
    teeth: consultation.teeth,
    notes: consultation.notes ?? "",
  };
}

export function EditConsultationDialog({
  consultation,
  patientName,
  treatmentOptions,
  open,
  onOpenChange,
}: {
  consultation: Consultation;
  patientName: string;
  treatmentOptions: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [dentitionMode, setDentitionMode] = useState<DentitionMode>("adulto");

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<EditConsultationValues>({
    resolver: zodResolver(editConsultationSchema),
    defaultValues: toFormValues(consultation, treatmentOptions),
  });

  useEffect(() => {
    if (open) {
      reset(toFormValues(consultation, treatmentOptions));
      setDentitionMode("adulto");
    }
  }, [open, consultation, treatmentOptions, reset]);

  const treatment = watch("treatment");
  const teeth = watch("teeth") ?? [];

  const onSubmit = async (values: EditConsultationValues) => {
    await updateConsultationAction(consultation.id, {
      date: combineDateAndTime(values.date, values.time),
      treatment: values.treatment === OTHER_TREATMENT ? values.treatmentOther!.trim() : values.treatment,
      teeth: values.teeth?.length ? values.teeth : undefined,
      notes: values.notes || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="size-4 text-primary" />
              Editar consulta
            </DialogTitle>
            <DialogDescription>
              Corregí lo que haga falta de esta visita.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Paciente</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                {consultation.patientId ? (
                  <Link
                    href={`/dashboard/pacientes/${consultation.patientId}`}
                    className="hover:underline"
                  >
                    {patientName}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{patientName}</span>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-date">Fecha</Label>
                <Input
                  id="edit-date"
                  type="date"
                  aria-invalid={!!errors.date}
                  {...register("date")}
                />
                {errors.date && (
                  <p className="text-sm text-destructive">{errors.date.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-time">Hora</Label>
                <Input
                  id="edit-time"
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
                      id="edit-teeth"
                      value={field.value ?? []}
                      onChange={field.onChange}
                      mode={dentitionMode}
                      onModeChange={(mode) => {
                        setDentitionMode(mode);
                        field.onChange([]);
                      }}
                    />
                  )}
                />
                {dentitionMode === "adulto" && (
                  <ToothChart3D selectedTeeth={teeth} autoFocus={false} />
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
                <p className="text-sm text-destructive">{errors.treatment.message}</p>
              )}
            </div>

            {treatment === OTHER_TREATMENT && (
              <div className="space-y-2">
                <Label htmlFor="edit-treatmentOther">Especificá el tratamiento</Label>
                <Input
                  id="edit-treatmentOther"
                  placeholder="Describí el tratamiento"
                  aria-invalid={!!errors.treatmentOther}
                  {...register("treatmentOther")}
                />
                {errors.treatmentOther && (
                  <p className="text-sm text-destructive">{errors.treatmentOther.message}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Observaciones (opcional)</Label>
              <Textarea
                id="edit-notes"
                placeholder="Diagnóstico, indicaciones, próxima cita..."
                rows={3}
                {...register("notes")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit">Guardar cambios</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
