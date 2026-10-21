import { Clock, Settings, ShieldPlus, Stethoscope } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OptionListManager } from "@/features/settings/components/option-list-manager";
import { ImportExcelDialog } from "@/features/excel/components/import-excel-dialog";
import { BusinessHoursManager } from "@/features/settings/components/business-hours-manager";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getClinicOptions } from "@/features/clinic/data/clinic-options";
import { getBusinessHours } from "@/features/clinic/data/business-hours";

export default async function ConfiguracionPage() {
  const clinic = await getCurrentClinic();
  const [insuranceOptions, treatmentOptions, businessHours] = clinic
    ? await Promise.all([
        getClinicOptions(clinic.id, "insurance"),
        getClinicOptions(clinic.id, "treatment"),
        getBusinessHours(clinic.id),
      ])
    : [[], [], []];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración"
        description="Parámetros propios de tu consultorio."
        icon={Settings}
      />

      <Tabs defaultValue="insurance">
        <TabsList>
          <TabsTrigger value="insurance">
            <ShieldPlus />
            Obras sociales
          </TabsTrigger>
          <TabsTrigger value="treatment">
            <Stethoscope />
            Tratamientos
          </TabsTrigger>
          <TabsTrigger value="hours">
            <Clock />
            Horario de atención
          </TabsTrigger>
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
            actions={<ImportExcelDialog kind="tratamientos" />}
            title="Tratamientos"
            description="Las opciones disponibles al cargar una consulta."
            options={treatmentOptions}
          />
        </TabsContent>
        <TabsContent value="hours">
          <BusinessHoursManager hours={businessHours} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
