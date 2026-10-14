"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ClipboardList, Plus, Save, UserPlus } from "lucide-react";

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
import {
  combineDateAndTime,
  formatCurrency,
  splitDateAndTime,
  toLocalDateString,
} from "@/features/clinic/lib/format";
import { PAYMENT_STATUS_LABELS } from "@/features/clinic/lib/billing";
import { OTHER_TREATMENT } from "@/features/clinic/lib/treatments";
import { OTHER_INSURANCE } from "@/features/clinic/lib/insurance";
import { createConsultationAction } from "@/features/consultations/actions";
import { LinkedAppointmentField } from "@/features/consultations/components/linked-appointment-field";
import {
  consultationSchema,
  NEW_PATIENT_VALUE,
  type ConsultationValues,
} from "@/features/consultations/lib/schema";

type PatientOption = { id: string; name: string };

/** The turno this consulta is being registered for, when opened from the
 * agenda — prefills its date/time, links it, and carries its motivo over
 * into Observaciones. */
type InitialAppointment = { id: string; startsAt: Date; reason: string | null };

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
  treatmentPrices = {},
  insuranceOptions = [],
  toothHistory = {},
  initialAppointment,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  patients?: PatientOption[];
  fixedPatientId?: string;
  fixedPatientName?: string;
  treatmentOptions: string[];
  treatmentPrices?: Record<string, number>;
  insuranceOptions?: string[];
  toothHistory?: ToothHistory;
  initialAppointment?: InitialAppointment;
  /** Controlled mode, for opening this programmatically (e.g. right
   * after marking a turno completed) instead of from its own trigger
   * button — omit both to keep the default self-contained behavior. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? openProp : internalOpen;
  const setOpen = isControlled ? onOpenChangeProp! : setInternalOpen;
  const [dentitionMode, setDentitionMode] = useState<DentitionMode>("adulto");

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
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
      ...(initialAppointment
        ? splitDateAndTime(initialAppointment.startsAt)
        : { date: todayISO(), time: nowHHMM() }),
      treatment: "",
      treatmentOther: "",
      teeth: [],
      notes: initialAppointment?.reason ?? "",
      amountCharged: "",
      paymentChoice: "PENDIENTE",
      partialAmountPaid: "",
      appointmentId: initialAppointment?.id ?? "",
    },
  });

  const patientId = watch("patientId");
  const date = watch("date");
  const appointmentId = watch("appointmentId") ?? "";
  // A brand-new patient can't have turnos yet, so there's nothing to link.
  const linkPatientId =
    fixedPatientId ?? (patientId && patientId !== NEW_PATIENT_VALUE ? patientId : undefined);
  const treatment = watch("treatment");
  const teeth = watch("teeth") ?? [];
  const isNewPatient = !fixedPatientId && patientId === NEW_PATIENT_VALUE;
  const paymentChoice = watch("paymentChoice");
  const listPrice = treatmentPrices[treatment];
  const [discountPercent, setDiscountPercent] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);

  /** Recalculates "Monto a cobrar" from the treatment's list price (minus
   * whatever discount % is already typed) every time the treatment
   * changes — but only while the dentist hasn't typed into the amount
   * field itself, so switching treatments never clobbers a monto they
   * set by hand. Switching to a treatment with no list price clears the
   * amount instead of leaving the previous treatment's figure behind. */
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

  const onSubmit = async (values: ConsultationValues) => {
    const finalPatientId = fixedPatientId ?? values.patientId;

    const chargedNum = values.amountCharged ? Number(values.amountCharged) : undefined;
    const paidNum =
      values.paymentChoice === "COBRADO"
        ? chargedNum
        : values.paymentChoice === "PARCIAL"
          ? Number(values.partialAmountPaid)
          : undefined;

    await createConsultationAction({
      patientId: finalPatientId,
      date: combineDateAndTime(values.date, values.time),
      treatment:
        values.treatment === OTHER_TREATMENT
          ? values.treatmentOther!.trim()
          : values.treatment,
      teeth: values.teeth?.length ? values.teeth : undefined,
      notes: values.notes || undefined,
      amountCharged: chargedNum,
      amountPaid: paidNum,
      appointmentId: values.appointmentId || undefined,
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
      amountCharged: "",
      paymentChoice: "PENDIENTE",
      partialAmountPaid: "",
      appointmentId: "",
    });
    setDiscountPercent("");
    setAmountTouched(false);
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
      {!isControlled && (
        <DialogTrigger asChild>
          <Button>
            <Plus />
            Nueva consulta
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="size-4 text-primary" />
              Nueva consulta
            </DialogTitle>
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

            <LinkedAppointmentField
              patientId={linkPatientId}
              day={date}
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

            {listPrice != null && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Precio de lista</Label>
                  <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                    {formatCurrency(listPrice)}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discountPercent">Descuento %</Label>
                  <Input
                    id="discountPercent"
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
              <Label htmlFor="amountCharged">Monto a cobrar (opcional)</Label>
              <Input
                id="amountCharged"
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
                <Label htmlFor="partialAmountPaid">Pagado hasta ahora</Label>
                <Input
                  id="partialAmountPaid"
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
