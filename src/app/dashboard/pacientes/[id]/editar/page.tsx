import Link from "next/link";
import { ArrowLeft, User } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getClinicOptions } from "@/features/clinic/data/clinic-options";
import { getPatient } from "@/features/clinic/data/patients";
import { PatientForm } from "@/features/patients/components/patient-form";

export default async function EditarPacientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clinic = await getCurrentClinic();
  const [patient, insuranceOptions] = clinic
    ? await Promise.all([getPatient(clinic.id, id), getClinicOptions(clinic.id, "insurance")])
    : [null, []];

  if (!patient) {
    return <p className="text-muted-foreground">No se encontró el paciente.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Editar paciente"
        description={patient.name}
        icon={User}
        action={
          <Button variant="outline" asChild>
            <Link href={`/dashboard/pacientes/${patient.id}`}>
              <ArrowLeft />
              Volver
            </Link>
          </Button>
        }
      />
      <PatientForm patient={patient} insuranceOptions={insuranceOptions.map((o) => o.label)} />
    </div>
  );
}
