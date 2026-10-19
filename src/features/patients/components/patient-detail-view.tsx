"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Info, User } from "lucide-react";
import type { Consultation, Patient } from "@prisma/client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { formatCurrency, formatDate } from "@/features/clinic/lib/format";
import { ConsultationsList } from "@/features/consultations/components/consultations-list";
import { NewConsultationDialog } from "@/features/consultations/components/new-consultation-dialog";
import type { SupplyOption } from "@/features/consultations/components/supplies-used-field";
import { ToothChart3D, type ToothHistory } from "@/features/clinic/components/tooth-chart-3d";
import { isValidToothFdi } from "@/features/clinic/lib/odontogram";
import { medicalAlerts } from "@/features/clinic/lib/medical";
import { MedicalAlert } from "@/features/patients/components/medical-alert";

function InfoField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

export function PatientDetailView({
  patient,
  consultations,
  treatmentOptions,
  treatmentPrices,
  supplyOptions,
  balance,
}: {
  patient: Patient | null;
  consultations: Consultation[];
  treatmentOptions: string[];
  treatmentPrices: Record<string, number>;
  supplyOptions: SupplyOption[];
  balance: number;
}) {
  const toothHistory: ToothHistory = useMemo(() => {
    const history: ToothHistory = {};
    for (const c of consultations) {
      for (const tooth of c.teeth) {
        if (isValidToothFdi(tooth)) {
          (history[tooth] ??= []).push({ date: c.date, treatment: c.treatment });
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

  // Patients booked in a hurry (e.g. from "Agregar paciente nuevo" while
  // scheduling a turno) only ever get a name and phone — without this,
  // the card below renders as an empty white box with nothing in it,
  // which reads as broken rather than as "nothing filled in yet".
  const hasAdditionalInfo =
    !!patient.email ||
    !!patient.dni ||
    !!patient.birthDate ||
    !!patient.address ||
    !!patient.insurance ||
    !!patient.insuranceNumber ||
    !!patient.allergies ||
    !!patient.medications;
  const alerts = medicalAlerts(patient);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard/pacientes"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver a pacientes
        </Link>
        <PageHeader
          title={patient.name}
          description={patient.phone}
          icon={User}
          action={
            <NewConsultationDialog
              fixedPatientId={patient.id}
              fixedPatientName={patient.name}
              treatmentOptions={treatmentOptions}
              treatmentPrices={treatmentPrices}
              supplyOptions={supplyOptions}
              toothHistory={toothHistory}
              fixedPatientAlerts={alerts}
            />
          }
        />
        {balance > 0 && (
          <p className="text-sm font-medium text-destructive">Debe: {formatCurrency(balance)}</p>
        )}
        <MedicalAlert alerts={alerts} />
      </div>

      <Card>
        {hasAdditionalInfo ? (
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <InfoField label="Email" value={patient.email} />
            <InfoField label="DNI" value={patient.dni} />
            <InfoField
              label="Fecha de nacimiento"
              value={formatDate(patient.birthDate?.toISOString().slice(0, 10))}
            />
            <InfoField label="Dirección" value={patient.address} />
            <InfoField label="Obra social" value={patient.insurance} />
            <InfoField label="N° de afiliado" value={patient.insuranceNumber} />
            <InfoField label="Alergias" value={patient.allergies} />
            <InfoField label="Medicación habitual" value={patient.medications} />
          </CardContent>
        ) : (
          <CardContent className="flex flex-col items-center gap-2 py-4 text-center text-muted-foreground">
            <Info className="size-5" />
            Todavía no se cargaron más datos de este paciente.
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Odontograma</CardTitle>
          <CardDescription>
            Vista de la boca del paciente. En verde, los dientes con
            consultas registradas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ToothChart3D history={toothHistory} />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Historial de consultas</h2>
        <ConsultationsList
          consultations={consultations}
          showPatient={false}
          fixedPatientName={patient.name}
          emptyMessage="Todavía no hay consultas registradas para este paciente."
          treatmentOptions={treatmentOptions}
          treatmentPrices={treatmentPrices}
          supplyOptions={supplyOptions}
        />
      </div>
    </div>
  );
}
