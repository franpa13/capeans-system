import { Clock, Layers, Settings, ShieldPlus, Stethoscope, UserRound, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OptionListManager } from "@/features/settings/components/option-list-manager";
import { TreatmentCatalog } from "@/features/settings/components/treatment-catalog";
import { BusinessHoursManager } from "@/features/settings/components/business-hours-manager";
import { ProfessionalsManager } from "@/features/settings/components/professionals-manager";
import { getProfessionals } from "@/features/clinic/data/professionals";
import { TeamManager } from "@/features/settings/components/team-manager";
import { getInvitations, getMembers } from "@/features/clinic/data/members";
import { getCurrentMember } from "@/features/clinic/data/current-member";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getClinicOptions } from "@/features/clinic/data/clinic-options";
import { getBusinessHours } from "@/features/clinic/data/business-hours";
import { hasPermission } from "@/features/clinic/data/current-member";
import { NoPermission } from "@/components/no-permission";

const TABS = ["insurance", "treatment", "specialty", "hours", "professionals", "team"];

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  if (!(await hasPermission("settings.manage"))) return <NoPermission what="la configuración" />;
  const clinic = await getCurrentClinic();
  const [insuranceOptions, treatmentOptions, specialtyOptions, businessHours, professionals] = clinic
    ? await Promise.all([
        getClinicOptions(clinic.id, "insurance"),
        getClinicOptions(clinic.id, "treatment"),
        getClinicOptions(clinic.id, "specialty"),
        getBusinessHours(clinic.id),
        getProfessionals(clinic.id),
      ])
    : [[], [], [], [], []];
  const me = (await getCurrentMember())?.member;
  const [members, invitations] = clinic
    ? await Promise.all([getMembers(clinic.id), getInvitations(clinic.id)])
    : [[], []];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración"
        description="Parámetros propios de tu consultorio."
        icon={Settings}
      />

      <Tabs defaultValue={tab && TABS.includes(tab) ? tab : "insurance"}>
        <TabsList>
          <TabsTrigger value="insurance">
            <ShieldPlus />
            Obras sociales
          </TabsTrigger>
          <TabsTrigger value="treatment">
            <Stethoscope />
            Tratamientos
          </TabsTrigger>
          <TabsTrigger value="specialty">
            <Layers />
            Especialidades
          </TabsTrigger>
          <TabsTrigger value="hours">
            <Clock />
            Horario de atención
          </TabsTrigger>
          <TabsTrigger value="professionals">
            <UserRound />
            Profesionales
          </TabsTrigger>
          <TabsTrigger value="team">
            <UsersRound />
            Equipo
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
          <TreatmentCatalog
            treatments={treatmentOptions}
            specialties={specialtyOptions.map((o) => o.label)}
          />
        </TabsContent>
        <TabsContent value="specialty">
          <OptionListManager
            category="specialty"
            title="Especialidades"
            description="Agrupan los tratamientos del catálogo (y sus contadores)."
            options={specialtyOptions}
          />
        </TabsContent>
        <TabsContent value="hours">
          <BusinessHoursManager hours={businessHours} />
        </TabsContent>
        <TabsContent value="team">
          {me && (
            <TeamManager
              meId={me.id}
              members={members.map((m) => ({
                id: m.id,
                name: m.name,
                email: m.email,
                role: m.role,
                professionalId: m.professionalId,
              }))}
              invitations={invitations.map((i) => ({ id: i.id, email: i.email, role: i.role }))}
            />
          )}
        </TabsContent>
        <TabsContent value="professionals">
          {clinic && (
            <ProfessionalsManager
              clinic={{ name: clinic.name, address: clinic.address, phone: clinic.phone, email: clinic.email }}
              professionals={professionals}
              specialties={specialtyOptions.map((o) => o.label)}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
