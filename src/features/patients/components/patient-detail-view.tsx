"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, User } from "lucide-react";
import type { Consultation, Patient } from "@prisma/client";

import { PageHeader } from "@/components/page-header";
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
import { PatientFiles, type PatientFileItem } from "@/features/patients/components/patient-files";


export function PatientDetailView({
  patient,
  consultations,
  treatmentOptions,
  treatmentPrices,
  supplyOptions,
  balance,
  noShows,
  files,
}: {
  patient: Patient | null;
  consultations: Consultation[];
  treatmentOptions: string[];
  treatmentPrices: Record<string, number>;
  supplyOptions: SupplyOption[];
  balance: number;
  /** Turnos this patient didn't come to. */
  noShows: number;
  files: PatientFileItem[];
}) {
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
            <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={`/dashboard/pacientes/${patient.id}/editar`}>
                <Pencil />
                Editar datos
              </Link>
            </Button>
            <NewConsultationDialog
              fixedPatientId={patient.id}
              fixedPatientName={patient.name}
              treatmentOptions={treatmentOptions}
              treatmentPrices={treatmentPrices}
              supplyOptions={supplyOptions}
              toothHistory={toothHistory}
              fixedPatientAlerts={alerts}
            />
            </div>
          }
        />
        {!patient.active && (
          <p className="w-fit rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            Inactivo: ya no se atiende
          </p>
        )}
        {balance > 0 && (
          <p className="text-sm font-medium text-destructive">Debe: {formatCurrency(balance)}</p>
        )}
        {noShows > 0 && (
          <p className="text-sm text-muted-foreground">
            Faltó a {noShows} {noShows === 1 ? "turno" : "turnos"}
          </p>
        )}
        <MedicalAlert alerts={alerts} />
      </div>

      <PatientInfoCard patient={patient} />

      <OdontogramCard
        history={toothHistory}
        consultations={consultations}
        patientName={patient.name}
      />

      <PatientFiles patientId={patient.id} files={files} />

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
