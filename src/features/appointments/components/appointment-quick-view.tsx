"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Pencil, Trash2, X } from "lucide-react";
import type { Appointment, AppointmentStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import {
  deleteAppointmentAction,
  updateAppointmentAction,
} from "@/features/appointments/actions";
import { ReminderButton } from "@/features/appointments/components/reminder-button";
import { APPOINTMENT_STATUS_LABELS } from "@/features/appointments/lib/status";
import { formatTime } from "@/features/clinic/lib/format";
import { insuranceColor, INSURANCE_DOT } from "@/features/clinic/lib/insurance-color";
import { medicalAlerts } from "@/features/clinic/lib/medical";
import { MedicalAlert } from "@/features/patients/components/medical-alert";
import type { AppointmentWithConsultation } from "@/features/clinic/data/appointments";
import { unwrap } from "@/lib/action-result";

/** What the quick view shows about the turno's patient — the full Patient
 * row fits, and every field but id/name is optional. */
export type QuickViewPatient = {
  id: string;
  name: string;
  phone?: string;
  insurance?: string | null;
  allergies?: string | null;
  medicalConditions?: string[];
  acceptsReminders?: boolean;
};

/** In the order a turno goes through them, then the two ways it doesn't. */
const STATES: AppointmentStatus[] = ["CONFIRMED", "WAITING", "COMPLETED", "NO_SHOW", "CANCELLED"];

const STATE_ACTIVE: Record<AppointmentStatus, string> = {
  CONFIRMED: "bg-primary text-primary-foreground hover:bg-primary/90",
  WAITING: "bg-amber-500 text-white hover:bg-amber-500/90",
  COMPLETED: "bg-emerald-600 text-white hover:bg-emerald-600/90",
  NO_SHOW: "bg-destructive text-white hover:bg-destructive/90",
  CANCELLED: "bg-muted-foreground/40 text-foreground hover:bg-muted-foreground/50",
};

/** Tapping a turno (in any agenda view) opens this beside it: who, when,
 * obra social, medical alerts, its state as one-tap buttons (Confirmado →
 * En sala de espera → Completado, or No vino / Cancelado), and the actions
 * — editar/reprogramar, registrar la consulta, recordar por WhatsApp,
 * eliminar. `children` is the turno card itself (the popover's trigger). */
export function AppointmentQuickView({
  appointment,
  patient,
  clinicName,
  onEdit,
  onRegisterConsulta,
  onCompleted,
  children,
}: {
  appointment: AppointmentWithConsultation;
  patient: QuickViewPatient | undefined;
  clinicName: string;
  onEdit: (appointment: Appointment) => void;
  onRegisterConsulta: (appointment: Appointment) => void;
  /** After marking Completado — lets the view offer to register the consulta. */
  onCompleted: (appointment: Appointment) => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patientName = patient?.name ?? "Sin paciente";
  const end = new Date(appointment.startsAt.getTime() + appointment.durationMinutes * 60_000);
  const insurance = patient?.insurance?.trim() || "Particular";
  const alerts = patient
    ? medicalAlerts({
        allergies: patient.allergies ?? null,
        medicalConditions: patient.medicalConditions ?? [],
      })
    : [];
  const canRegister =
    !!patient && !appointment.consultation && !["CANCELLED", "NO_SHOW"].includes(appointment.status);

  async function changeStatus(status: AppointmentStatus) {
    if (status === appointment.status) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await unwrap(updateAppointmentAction(appointment.id, { status }));
      router.refresh();
      if (status === "COMPLETED") {
        setOpen(false);
        onCompleted(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await unwrap(deleteAppointmentAction(appointment.id));
      setConfirmDelete(false);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setConfirmDelete(false);
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  }

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setError(null);
        }}
      >
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent
          aria-label={`Turno de ${patientName}`}
          className="w-80 space-y-3 p-4"
          align="start"
          collisionPadding={12}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              {patient ? (
                <Link
                  href={`/dashboard/pacientes/${patient.id}`}
                  className="block truncate text-base font-semibold hover:underline"
                >
                  {patientName}
                </Link>
              ) : (
                <p className="text-base font-semibold text-muted-foreground">{patientName}</p>
              )}
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium tabular-nums">
                  {formatTime(appointment.startsAt)} – {formatTime(end)}
                </span>
                <span className="rounded-full bg-muted px-2 py-px text-xs text-muted-foreground">
                  {appointment.durationMinutes} min
                </span>
              </p>
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Cerrar"
              onClick={() => setOpen(false)}
            >
              <X />
            </Button>
          </div>

          <div className="space-y-1 text-sm">
            <p>{appointment.reason || <span className="text-muted-foreground">Sin motivo</span>}</p>
            {patient && (
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <span className={`size-2.5 rounded-full ${INSURANCE_DOT[insuranceColor(patient.insurance)]}`} />
                {insurance}
              </p>
            )}
          </div>

          <MedicalAlert alerts={alerts} />

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Estado</p>
            <div className="flex flex-wrap gap-1.5">
              {STATES.map((state) => {
                const active = appointment.status === state;
                return (
                  <Button
                    key={state}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    aria-pressed={active}
                    disabled={saving}
                    className={`h-7 rounded-full px-2.5 text-xs ${active ? STATE_ACTIVE[state] : ""}`}
                    onClick={() => changeStatus(state)}
                  >
                    {APPOINTMENT_STATUS_LABELS[state]}
                  </Button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false);
                onEdit(appointment);
              }}
            >
              <Pencil />
              Editar
            </Button>
            {canRegister && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  onRegisterConsulta(appointment);
                }}
              >
                <ClipboardList />
                Registrar consulta
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Eliminar turno"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 />
            </Button>
          </div>
          {appointment.status === "CONFIRMED" && patient?.phone !== undefined && (
            <ReminderButton
              appointmentId={appointment.id}
              startsAt={appointment.startsAt}
              reminderSentAt={appointment.reminderSentAt}
              patientName={patientName}
              phone={patient.phone}
              clinicName={clinicName}
              acceptsReminders={patient.acceptsReminders}
            />
          )}
        </PopoverContent>
      </Popover>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este turno?</AlertDialogTitle>
            <AlertDialogDescription>
              El turno de {patientName} del {appointment.startsAt.toLocaleDateString("es-AR")} a las{" "}
              {formatTime(appointment.startsAt)}. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X />
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive! text-white! hover:bg-destructive/90!"
            >
              <Trash2 />
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
