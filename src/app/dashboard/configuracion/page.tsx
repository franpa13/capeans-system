import { PageHeader } from "@/components/page-header";
import { OptionListManager } from "@/features/settings/components/option-list-manager";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getClinicOptions } from "@/features/clinic/data/clinic-options";

export default async function ConfiguracionPage() {
  const clinic = await getCurrentClinic();
  const [insuranceOptions, treatmentOptions] = clinic
    ? await Promise.all([
        getClinicOptions(clinic.id, "insurance"),
        getClinicOptions(clinic.id, "treatment"),
      ])
    : [[], []];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración"
        description="Parámetros propios de tu consultorio."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <OptionListManager
          category="insurance"
          title="Obras sociales"
          description="Las opciones disponibles al cargar un paciente."
          options={insuranceOptions}
        />
        <OptionListManager
          category="treatment"
          title="Tratamientos"
          description="Las opciones disponibles al cargar una consulta."
          options={treatmentOptions}
        />
      </div>
    </div>
  );
}
