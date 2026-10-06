"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { OTHER_TREATMENT } from "@/features/clinic/lib/treatments";
import {
  deleteConsultationAction,
  updateConsultationAction,
} from "@/features/consultations/actions";
import { editConsultationSchema, type EditConsultationValues } from "@/features/consultations/lib/schema";
import type { Consultation } from "@prisma/client";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toFormValues(consultation: Consultation, treatmentOptions: string[]): EditConsultationValues {
  const knownTreatment = treatmentOptions.includes(consultation.treatment);
  return {
    date: toDateInputValue(consultation.date),
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
  const [deleteOpen, setDeleteOpen] = useState(false);

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
      date: new Date(values.date),
      treatment: values.treatment === OTHER_TREATMENT ? values.treatmentOther!.trim() : values.treatment,
      teeth: values.teeth?.length ? values.teeth : undefined,
      notes: values.notes || undefined,
    });
    onOpenChange(false);
  };

  const onDelete = async () => {
    await deleteConsultationAction(consultation.id);
    setDeleteOpen(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <DialogHeader>
              <DialogTitle>Editar consulta</DialogTitle>
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
                  {dentitionMode === "adulto" && <ToothChart3D selectedTeeth={teeth} />}
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

            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 />
                Eliminar
              </Button>
              <Button type="submit">Guardar cambios</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta consulta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El registro de esta visita
              para {patientName} se va a borrar por completo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive! text-white! hover:bg-destructive/90!"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
