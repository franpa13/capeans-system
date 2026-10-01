import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Consultation, Patient } from "@prisma/client";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { formatDate } from "@/features/clinic/lib/format";
import { ConsultationsList } from "@/features/consultations/components/consultations-list";
import { NewConsultationDialog } from "@/features/consultations/components/new-consultation-dialog";

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
}: {
  patient: Patient | null;
  consultations: Consultation[];
}) {
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
          action={
            <NewConsultationDialog
              fixedPatientId={patient.id}
              fixedPatientName={patient.name}
            />
          }
        />
      </div>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <InfoField label="Email" value={patient.email} />
          <InfoField label="DNI" value={patient.dni} />
          <InfoField
            label="Fecha de nacimiento"
            value={formatDate(patient.birthDate?.toISOString().slice(0, 10))}
          />
          <InfoField label="Dirección" value={patient.address} />
          <InfoField label="Obra social" value={patient.insurance} />
          <InfoField label="Alergias / antecedentes" value={patient.allergies} />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Historial de consultas</h2>
        <ConsultationsList
          consultations={consultations}
          showPatient={false}
          emptyMessage="Todavía no hay consultas registradas para este paciente."
        />
      </div>
    </div>
  );
}
