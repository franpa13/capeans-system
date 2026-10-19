"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Boxes,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  MessageCircle,
  Wallet,
} from "lucide-react";
import type { Appointment, Supply } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/features/clinic/lib/format";
import { isLowStock } from "@/features/clinic/lib/stock";
import { PENDING_OR_PARTIAL } from "@/features/clinic/lib/billing";
import { NewConsultationDialog } from "@/features/consultations/components/new-consultation-dialog";
import { ReminderButton } from "@/features/appointments/components/reminder-button";
import type { AppointmentWithConsultation } from "@/features/clinic/data/appointments";
import type { SupplyOption } from "@/features/consultations/components/supplies-used-field";

type PatientOption = {
  id: string;
  name: string;
  phone: string;
  allergies: string | null;
  medicalConditions: string[];
};
type Debt = { patientId: string; name: string; amount: number };

const MAX_DEBTS = 5;

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** A card that's also a labeled page region, so each block can be found
 * by its title (for screen readers, and for the E2E tests). */
function Section({
  id,
  title,
  description,
  icon: Icon,
  children,
  footer,
}: {
  id: string;
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-muted-foreground" />
            <CardTitle id={id} className="text-base">
              {title}
            </CardTitle>
          </div>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {children}
          {footer}
        </CardContent>
      </Card>
    </section>
  );
}

function SeeAll({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button variant="ghost" size="sm" className="self-start" asChild>
      <Link href={href}>
        {children}
        <ArrowRight />
      </Link>
    </Button>
  );
}

/** Inicio's "what do I have today" view: today's turnos in order (with a
 * one-click "Registrar consulta" for each one still without its consulta),
 * who owes money, and which insumos are running out. */
export function TodayPanel({
  appointments,
  reminderAppointments,
  clinicName,
  patients,
  debts,
  supplies,
  insuranceOptions,
  treatmentOptions,
  treatmentPrices,
  supplyOptions,
}: {
  appointments: AppointmentWithConsultation[];
  /** Confirmed turnos in the next 24 hours — the ones worth a reminder now. */
  reminderAppointments: AppointmentWithConsultation[];
  clinicName: string;
  patients: PatientOption[];
  debts: Debt[];
  supplies: Supply[];
  insuranceOptions: string[];
  treatmentOptions: string[];
  treatmentPrices: Record<string, number>;
  supplyOptions: SupplyOption[];
}) {
  const router = useRouter();
  const patientsById = new Map(patients.map((p) => [p.id, p.name]));
  const phonesById = new Map(patients.map((p) => [p.id, p.phone]));
  const remindable = reminderAppointments.filter((a) => a.patientId);
  const todayKey = new Date().toDateString();
  const [registering, setRegistering] = useState<{
    patient: { id: string; name: string };
    appointment: Appointment;
  } | null>(null);

  const lowStock = supplies
    .map((supply) => ({ supply, level: isLowStock(supply.quantity, supply.lowStockAt) }))
    .filter(({ level }) => level !== "ok");

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Section
          id="today-turnos"
          title="Turnos de hoy"
          description={
            appointments.length === 0
              ? undefined
              : `${appointments.length} ${appointments.length === 1 ? "turno" : "turnos"}`
          }
          icon={CalendarDays}
          footer={<SeeAll href="/dashboard/turnos?view=day">Ver agenda</SeeAll>}
        >
          {appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tenés turnos para hoy.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {appointments.map((appointment) => {
                const patientName = appointment.patientId
                  ? (patientsById.get(appointment.patientId) ?? "Paciente")
                  : "Sin paciente";
                return (
                  <li
                    key={appointment.id}
                    className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">
                        {formatTime(appointment.startsAt)}
                      </span>
                      <div className="flex min-w-0 flex-col">
                        {appointment.patientId ? (
                          <Link
                            href={`/dashboard/pacientes/${appointment.patientId}`}
                            className="truncate text-sm font-medium hover:underline"
                          >
                            {patientName}
                          </Link>
                        ) : (
                          <span className="truncate text-sm font-medium">{patientName}</span>
                        )}
                        {appointment.reason && (
                          <span className="truncate text-sm text-muted-foreground">
                            {appointment.reason}
                          </span>
                        )}
                      </div>
                    </div>
                    {appointment.consultation ? (
                      <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                        <ClipboardCheck className="size-4" />
                        Consulta registrada
                      </span>
                    ) : (
                      appointment.patientId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 self-start sm:self-auto"
                          onClick={() =>
                            setRegistering({
                              patient: {
                                id: appointment.patientId!,
                                name: patientName,
                              },
                              appointment,
                            })
                          }
                        >
                          <ClipboardList />
                          Registrar consulta
                        </Button>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section
          id="upcoming-reminders"
          title="Recordatorios: próximas 24 hs"
          description="Mandale a cada paciente un WhatsApp con su turno ya escrito."
          icon={MessageCircle}
        >
          {remindable.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay turnos en las próximas 24 horas.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {remindable.map((appointment) => {
                const patientName = patientsById.get(appointment.patientId!) ?? "Paciente";
                return (
                  <li
                    key={appointment.id}
                    className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-16 shrink-0 text-xs text-muted-foreground">
                        {appointment.startsAt.toDateString() === todayKey ? "Hoy" : "Mañana"}
                      </span>
                      <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">
                        {formatTime(appointment.startsAt)}
                      </span>
                      <span className="truncate text-sm font-medium">{patientName}</span>
                    </div>
                    <ReminderButton
                      appointmentId={appointment.id}
                      startsAt={appointment.startsAt}
                      reminderSentAt={appointment.reminderSentAt}
                      patientName={patientName}
                      phone={phonesById.get(appointment.patientId!) ?? ""}
                      clinicName={clinicName}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      <div className="flex flex-col gap-4">
        <Section
          id="today-debts"
          title="Le deben"
          icon={Wallet}
          footer={
            debts.length > MAX_DEBTS && (
              <SeeAll href={`/dashboard/consultas?cobro=${PENDING_OR_PARTIAL}`}>
                Ver todos ({debts.length})
              </SeeAll>
            )
          }
        >
          {debts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nadie te debe plata.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {debts.slice(0, MAX_DEBTS).map((debt) => (
                <li
                  key={debt.patientId}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <Link
                    href={`/dashboard/pacientes/${debt.patientId}`}
                    className="truncate font-medium hover:underline"
                  >
                    {debt.name}
                  </Link>
                  <span className="shrink-0 text-muted-foreground">
                    {formatCurrency(debt.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          id="today-stock"
          title="Stock bajo"
          icon={Boxes}
          footer={
            lowStock.length > 0 && <SeeAll href="/dashboard/stock">Ir a Stock</SeeAll>
          }
        >
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todos los insumos tienen stock.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {lowStock.map(({ supply, level }) => (
                <li
                  key={supply.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="truncate font-medium">{supply.name}</span>
                  <span
                    className={`shrink-0 ${level === "out" ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`}
                  >
                    {supply.quantity} {supply.unit} ·{" "}
                    {level === "out" ? "Sin stock" : "Stock bajo"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {registering && (
        <NewConsultationDialog
          patients={patients}
          fixedPatientId={registering.patient.id}
          fixedPatientName={registering.patient.name}
          treatmentOptions={treatmentOptions}
          treatmentPrices={treatmentPrices}
          insuranceOptions={insuranceOptions}
          initialAppointment={registering.appointment}
          supplyOptions={supplyOptions}
          open
          onOpenChange={(next) => {
            if (!next) {
              setRegistering(null);
              // The consulta's own actions revalidate Consultas/Turnos, not
              // Inicio — refresh so this turno flips to "Consulta registrada"
              // and a new debt shows up under "Le deben".
              router.refresh();
            }
          }}
        />
      )}
    </div>
  );
}
