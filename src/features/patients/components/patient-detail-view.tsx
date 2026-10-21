"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  ClipboardPlus,
  FileHeart,
  Home,
  Images,
  Pencil,
  Pill,
  Smile,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Appointment, Consultation, Patient } from "@prisma/client";

import { formatCurrency } from "@/features/clinic/lib/format";
import { ConsultationsList } from "@/features/consultations/components/consultations-list";
import { NewConsultationDialog } from "@/features/consultations/components/new-consultation-dialog";
import type { SupplyOption } from "@/features/consultations/components/supplies-used-field";
import type { ToothHistory } from "@/features/clinic/components/tooth-chart-3d";
import { isValidToothFdi } from "@/features/clinic/lib/odontogram";
import { medicalAlerts } from "@/features/clinic/lib/medical";
import { MedicalAlert } from "@/features/patients/components/medical-alert";
import { PatientInfoCard } from "@/features/patients/components/patient-info-card";
import { Button } from "@/components/ui/button";
import { OdontogramCard } from "@/features/patients/components/odontogram-card";
import type { FindingView } from "@/features/patients/components/odontogram-2d";
import {
  PatientPrescriptions,
  type PrescriptionListItem,
} from "@/features/prescriptions/components/patient-prescriptions";
import type { ProfessionalOption } from "@/features/prescriptions/components/new-prescription-dialog";
import {
  PatientOrders,
  type OrderListItem,
} from "@/features/orders/components/patient-orders";
import {
  PatientFiles,
  type PatientFileItem,
} from "@/features/patients/components/patient-files";
import {
  PatientNotes,
  type PatientNoteItem,
} from "@/features/patients/components/patient-notes";
import {
  PatientPayments,
  type PatientPaymentItem,
} from "@/features/patients/components/patient-payments";
import {
  PersonalDataCard,
  RecentAppointmentsCard,
} from "@/features/patients/components/patient-summary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ageOn, displayName, initials } from "@/features/patients/lib/profile";
import { useCan } from "@/features/clinic/components/permissions-provider";

const SECTIONS = [
  "resumen",
  "ficha",
  "consultas",
  "odontograma",
  "estudios",
  "recetas",
  "ordenes",
  "pagos",
] as const;
type Section = (typeof SECTIONS)[number];
/** What recepción sees of a ficha: no historia clínica. */
const NON_CLINICAL: Section[] = ["resumen", "pagos"];

/** One big tile of the ficha's section bar. A `flag` (e.g. "Debe
 * $30.000") sits on its top edge, a `count` in its corner. */
function SectionTile({
  value,
  icon: Icon,
  label,
  count,
  flag,
}: {
  value: Section;
  icon: LucideIcon;
  label: React.ReactNode;
  count?: number;
  flag?: string;
}) {
  return (
    <TabsTrigger
      value={value}
      className="relative h-auto flex-col gap-2 rounded-xl border border-border bg-card px-2 py-4 text-sm whitespace-normal text-muted-foreground shadow-xs not-data-active:hover:border-primary/40 not-data-active:hover:text-foreground data-active:border-primary data-active:bg-card data-active:text-primary data-active:shadow-sm dark:data-active:border-primary dark:data-active:bg-card dark:data-active:text-primary [&_svg:not([class*='size-'])]:size-5"
    >
      {flag && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-background px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-destructive ring-1 ring-destructive/40 ring-inset">
          {flag}
        </span>
      )}
      {!!count && (
        <span className="absolute top-1.5 right-1.5 min-w-5 rounded-full bg-primary/10 px-1.5 text-xs font-semibold text-primary tabular-nums">
          {count}
        </span>
      )}
      <Icon />
      {label}
    </TabsTrigger>
  );
}

export function PatientDetailView({
  patient,
  consultations,
  treatmentOptions,
  treatmentPrices,
  treatmentCashPrices = {},
  supplyOptions,
  balance,
  noShows,
  files,
  appointments,
  notes,
  payments,
  findings,
  prescriptions,
  professionals,
  orders,
  initialSection,
}: {
  patient: Patient | null;
  consultations: Consultation[];
  treatmentOptions: string[];
  treatmentPrices: Record<string, number>;
  treatmentCashPrices?: Record<string, number>;
  supplyOptions: SupplyOption[];
  balance: number;
  /** Turnos this patient didn't come to. */
  noShows: number;
  files: PatientFileItem[];
  /** "Últimos turnos": the coming ones first, then the latest. */
  appointments: Appointment[];
  notes: PatientNoteItem[];
  payments: PatientPaymentItem[];
  /** Hallazgos on the odontograma. */
  findings: FindingView[];
  prescriptions: PrescriptionListItem[];
  /** Who can sign a new receta. */
  professionals: ProfessionalOption[];
  orders: OrderListItem[];
  /** ?seccion=… — e.g. back from a receta to the Recetas section. */
  initialSection?: string;
}) {
  const clinical = useCan("clinical.view");
  const sections = clinical ? SECTIONS : NON_CLINICAL;
  const [section, setSection] = useState<Section>(
    sections.includes(initialSection as Section)
      ? (initialSection as Section)
      : "resumen",
  );
  const toothHistory: ToothHistory = useMemo(() => {
    const history: ToothHistory = {};
    for (const c of consultations) {
      for (const tooth of c.teeth) {
        if (isValidToothFdi(tooth)) {
          (history[tooth] ??= []).push({
            date: c.date,
            treatment: c.treatment,
            consultationId: c.id,
            notes: c.notes,
          });
        }
      }
    }
    for (const entries of Object.values(history)) {
      entries.sort((a, b) => b.date.getTime() - a.date.getTime());
    }
    return history;
  }, [consultations]);

  if (!patient) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/pacientes"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver a pacientes
        </Link>
        <p className="text-muted-foreground">No se encontró el paciente.</p>
      </div>
    );
  }

  const alerts = medicalAlerts(patient);
  const age = ageOn(patient.birthDate);
  const subtitle = [
    age != null ? `${age} años` : null,
    patient.dni ? `DNI ${patient.dni}` : null,
    patient.insurance,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary"
          >
            {initials(patient)}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {displayName(patient)}
              </h1>
              {patient.active ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  Activo
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Inactivo: ya no se atiende
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <NewConsultationDialog
            fixedPatientId={patient.id}
            fixedPatientName={patient.name}
            treatmentOptions={treatmentOptions}
            treatmentPrices={treatmentPrices}
            treatmentCashPrices={treatmentCashPrices}
            supplyOptions={supplyOptions}
            toothHistory={toothHistory}
            fixedPatientAlerts={alerts}
          />
          <Button variant="outline" asChild>
            <Link href={`/dashboard/pacientes/${patient.id}/editar`}>
              <Pencil />
              Editar
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/pacientes">
              <ArrowLeft />
              Volver
            </Link>
          </Button>
        </div>
      </div>

      <MedicalAlert alerts={alerts} />

      <Tabs
        value={section}
        onValueChange={(v) => setSection(v as Section)}
        className="gap-6"
      >
        <TabsList
          aria-label="Secciones del paciente"
          className={`grid h-auto w-full items-stretch gap-3 bg-transparent p-0 pt-2.5 group-data-horizontal/tabs:h-auto ${
            clinical ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-8" : "max-w-md grid-cols-2"
          }`}
        >
          <SectionTile value="resumen" icon={Home} label="Resumen" />
          {clinical && (
            <>
              <SectionTile
                value="ficha"
                icon={FileHeart}
                label="Ficha médica"
              />
              <SectionTile
                value="consultas"
                icon={ClipboardList}
                label={
                  <>
                    Turnos/
                    <wbr />
                    Tratamientos
                  </>
                }
                count={consultations.length}
                flag={
                  balance > 0 ? `Debe ${formatCurrency(balance)}` : undefined
                }
              />
              <SectionTile
                value="odontograma"
                icon={Smile}
                label="Odontograma"
              />
              <SectionTile
                value="estudios"
                icon={Images}
                label="Estudios"
                count={files.length}
              />
              <SectionTile
                value="recetas"
                icon={Pill}
                label="Recetas"
                count={prescriptions.length}
              />
              <SectionTile
                value="ordenes"
                icon={ClipboardPlus}
                label="Órdenes"
                count={orders.length}
              />
            </>
          )}
          <SectionTile
            value="pagos"
            icon={Wallet}
            label="Pagos"
            count={payments.length}
            // Without the consultas tile, the debt shows here.
            flag={!clinical && balance > 0 ? `Debe ${formatCurrency(balance)}` : undefined}
          />
        </TabsList>

        <TabsContent value="resumen" className="flex flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <PersonalDataCard patient={patient} />
            <RecentAppointmentsCard
              appointments={appointments}
              noShows={noShows}
            />
          </div>
          <PatientNotes patientId={patient.id} notes={notes} />
        </TabsContent>

        <TabsContent value="ficha">
          <PatientInfoCard patient={patient} />
        </TabsContent>

        <TabsContent value="consultas">
          <h2 className="mb-3 text-lg font-semibold">Historial de consultas</h2>
          <ConsultationsList
            consultations={consultations}
            showPatient={false}
            fixedPatientName={patient.name}
            emptyMessage="Todavía no hay consultas registradas para este paciente."
            treatmentOptions={treatmentOptions}
            treatmentPrices={treatmentPrices}
            treatmentCashPrices={treatmentCashPrices}
            supplyOptions={supplyOptions}
          />
        </TabsContent>

        <TabsContent value="odontograma">
          <OdontogramCard
            patientId={patient.id}
            findings={findings}
            history={toothHistory}
            consultations={consultations}
            patientName={patient.name}
          />
        </TabsContent>

        <TabsContent value="estudios">
          <PatientFiles patientId={patient.id} files={files} />
        </TabsContent>

        <TabsContent value="recetas">
          <PatientPrescriptions
            patientId={patient.id}
            patientName={patient.name}
            prescriptions={prescriptions}
            professionals={professionals}
            treatments={[...new Set(consultations.map((c) => c.treatment))]}
            medicalHistory={{
              allergies: patient.allergies,
              medicalConditions: patient.medicalConditions,
            }}
          />
        </TabsContent>

        <TabsContent value="ordenes">
          <PatientOrders
            patientId={patient.id}
            patientName={patient.name}
            orders={orders}
            professionals={professionals}
          />
        </TabsContent>

        <TabsContent value="pagos">
          <PatientPayments payments={payments} balance={balance} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
