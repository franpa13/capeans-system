import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getClinicOptions } from "@/features/clinic/data/clinic-options";
import { PatientForm } from "@/features/patients/components/patient-form";

export default async function NuevoPacientePage() {
  const clinic = await getCurrentClinic();
  const insuranceOptions = clinic ? await getClinicOptions(clinic.id, "insurance") : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nuevo paciente"
        description="Solo nombre, apellido y teléfono son obligatorios; el resto se puede completar después."
        icon={UserPlus}
        action={
          <Button variant="outline" asChild>
            <Link href="/dashboard/pacientes">
              <ArrowLeft />
              Volver
            </Link>
          </Button>
        }
      />
      <PatientForm insuranceOptions={insuranceOptions.map((o) => o.label)} />
    </div>
  );
}
