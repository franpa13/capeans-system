import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

      <Tabs defaultValue="insurance">
        <TabsList>
          <TabsTrigger value="insurance">Obras sociales</TabsTrigger>
          <TabsTrigger value="treatment">Tratamientos</TabsTrigger>
        </TabsList>
        <TabsContent value="insurance">
          <OptionListManager
            category="insurance"
            title="Obras sociales"
            description="Las opciones disponibles al cargar un paciente."
            options={insuranceOptions}
          />
        </TabsContent>
        <TabsContent value="treatment">
          <OptionListManager
            category="treatment"
            title="Tratamientos"
            description="Las opciones disponibles al cargar una consulta."
            options={treatmentOptions}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
