"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Save } from "lucide-react";
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
import { combineDateAndTime, formatCurrency, splitDateAndTime } from "@/features/clinic/lib/format";
import { paymentStatus, PAYMENT_STATUS_LABELS } from "@/features/clinic/lib/billing";
import { OTHER_TREATMENT } from "@/features/clinic/lib/treatments";
import { getConsultationUsagesAction, updateConsultationAction } from "@/features/consultations/actions";
import { LinkedAppointmentField } from "@/features/consultations/components/linked-appointment-field";
import {
  SuppliesUsedField,
  type SupplyOption,
} from "@/features/consultations/components/supplies-used-field";
import type { SupplyUsageInput } from "@/features/clinic/data/consultations";
import { editConsultationSchema, type EditConsultationValues } from "@/features/consultations/lib/schema";
import type { Consultation } from "@prisma/client";

function toFormValues(consultation: Consultation, treatmentOptions: string[]): EditConsultationValues {
  const knownTreatment = treatmentOptions.includes(consultation.treatment);
  const status = paymentStatus(consultation.amountCharged, consultation.amountPaid);
  return {
    ...splitDateAndTime(consultation.date),
    treatment: knownTreatment ? consultation.treatment : OTHER_TREATMENT,
    treatmentOther: knownTreatment ? "" : consultation.treatment,
    teeth: consultation.teeth,
    notes: consultation.notes ?? "",
    amountCharged: consultation.amountCharged != null ? String(consultation.amountCharged) : "",
    paymentChoice: status === "SIN_MONTO" ? "PENDIENTE" : status,
    partialAmountPaid: status === "PARCIAL" ? String(consultation.amountPaid) : "",
    appointmentId: consultation.appointmentId ?? "",
  };
}

export function EditConsultationDialog({
  consultation,
  patientName,
  treatmentOptions,
  treatmentPrices,
  supplyOptions = [],
  open,
  onOpenChange,
}: {
  consultation: Consultation;
  patientName: string;
  treatmentOptions: string[];
  treatmentPrices: Record<string, number>;
  supplyOptions?: SupplyOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [dentitionMode, setDentitionMode] = useState<DentitionMode>("adulto");
  const [discountPercent, setDiscountPercent] = useState("");
  const [amountTouched, setAmountTouched] = useState(consultation.amountCharged != null);
  // null until the consulta's existing usages arrive — saving before then
  // would send "no supplies" and put them all back into stock.
  const [supplyUsages, setSupplyUsages] = useState<SupplyUsageInput[] | null>(null);
  const [supplyPending, setSupplyPending] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EditConsultationValues>({
    resolver: zodResolver(editConsultationSchema),
    defaultValues: toFormValues(consultation, treatmentOptions),
  });

  useEffect(() => {
    if (open) {
      reset(toFormValues(consultation, treatmentOptions));
      setDentitionMode("adulto");
      setDiscountPercent("");
      setAmountTouched(consultation.amountCharged != null);
    }
  }, [open, consultation, treatmentOptions, reset]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getConsultationUsagesAction(consultation.id).then((usages) => {
      if (cancelled) return;
      setSupplyUsages(usages.map((u) => ({ supplyId: u.supplyId, quantityUsed: u.quantityUsed })));
    });
    return () => {
      cancelled = true;
    };
  }, [open, consultation.id]);

  const treatment = watch("treatment");
  const teeth = watch("teeth") ?? [];
  const paymentChoice = watch("paymentChoice");
  const date = watch("date");
  const appointmentId = watch("appointmentId") ?? "";
  const listPrice = treatmentPrices[treatment];

  useEffect(() => {
    if (amountTouched) return;
    if (listPrice == null) {
      setValue("amountCharged", "");
      return;
    }
    const pct = Number(discountPercent) || 0;
    setValue("amountCharged", String(Math.round(listPrice * (1 - pct / 100))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treatment]);

  const onSubmit = async (values: EditConsultationValues) => {
    if (supplyUsages === null) return;
    const chargedNum = values.amountCharged ? Number(values.amountCharged) : undefined;
    const paidNum =
      values.paymentChoice === "COBRADO"
        ? chargedNum
        : values.paymentChoice === "PARCIAL"
          ? Number(values.partialAmountPaid)
          : undefined;

    await updateConsultationAction(consultation.id, {
      date: combineDateAndTime(values.date, values.time),
      treatment: values.treatment === OTHER_TREATMENT ? values.treatmentOther!.trim() : values.treatment,
      teeth: values.teeth?.length ? values.teeth : undefined,
      notes: values.notes || undefined,
      amountCharged: chargedNum,
      amountPaid: paidNum,
      appointmentId: values.appointmentId || null,
      supplies: supplyUsages.length ? supplyUsages : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
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

            <LinkedAppointmentField
              idPrefix="edit-"
              patientId={consultation.patientId ?? undefined}
              day={date}
              excludeConsultationId={consultation.id}
              value={appointmentId}
              onChange={(id) => setValue("appointmentId", id)}
            />

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

            {listPrice != null && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Precio de lista</Label>
                  <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                    {formatCurrency(listPrice)}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-discountPercent">Descuento %</Label>
                  <Input
                    id="edit-discountPercent"
                    type="number"
                    min={0}
                    max={100}
                    placeholder="0"
                    value={discountPercent}
                    onChange={(e) => {
                      const pct = e.target.value;
                      setDiscountPercent(pct);
                      // Not a manual amount override — the discount stays
                      // a calculator, so switching treatments afterward
                      // still recalculates from the new list price.
                      const pctNum = Math.min(100, Math.max(0, Number(pct) || 0));
                      setValue("amountCharged", String(Math.round(listPrice * (1 - pctNum / 100))));
                    }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-amountCharged">Monto a cobrar (opcional)</Label>
              <Input
                id="edit-amountCharged"
                type="number"
                min={0}
                placeholder="0"
                aria-invalid={!!errors.amountCharged}
                {...register("amountCharged", { onChange: () => setAmountTouched(true) })}
              />
              {errors.amountCharged && (
                <p className="text-sm text-destructive">{errors.amountCharged.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Estado del cobro</Label>
              <div className="flex w-fit gap-1 rounded-md border p-1">
                {(["PENDIENTE", "PARCIAL", "COBRADO"] as const).map((choice) => (
                  <Button
                    key={choice}
                    type="button"
                    size="sm"
                    variant={paymentChoice === choice ? "secondary" : "ghost"}
                    onClick={() => setValue("paymentChoice", choice)}
                  >
                    {PAYMENT_STATUS_LABELS[choice]}
                  </Button>
                ))}
              </div>
            </div>

            {paymentChoice === "PARCIAL" && (
              <div className="space-y-2">
                <Label htmlFor="edit-partialAmountPaid">Pagado hasta ahora</Label>
                <Input
                  id="edit-partialAmountPaid"
                  type="number"
                  min={0}
                  aria-invalid={!!errors.partialAmountPaid}
                  {...register("partialAmountPaid")}
                />
                {errors.partialAmountPaid && (
                  <p className="text-sm text-destructive">{errors.partialAmountPaid.message}</p>
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

            {supplyOptions.length > 0 &&
              (supplyUsages === null ? (
                <p className="text-sm text-muted-foreground">Cargando insumos usados...</p>
              ) : (
                <SuppliesUsedField
                  idPrefix="edit-"
                  supplies={supplyOptions}
                  value={supplyUsages}
                  onChange={setSupplyUsages}
                  onPendingChange={setSupplyPending}
                />
              ))}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={supplyUsages === null || supplyPending}>
              <Save />
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
