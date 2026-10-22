import {
  Building2,
  Clock,
  Layers,
  Settings,
  ShieldPlus,
  Stethoscope,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NoPermission } from "@/components/no-permission";
import { OptionListManager } from "@/features/settings/components/option-list-manager";
import { TreatmentCatalog } from "@/features/settings/components/treatment-catalog";
import { BusinessHoursManager } from "@/features/settings/components/business-hours-manager";
import {
  ClinicDetailsCard,
  ProfessionalsManager,
} from "@/features/settings/components/professionals-manager";
import { TeamManager } from "@/features/settings/components/team-manager";
import { getProfessionals } from "@/features/clinic/data/professionals";
import { getInvitations, getMembers } from "@/features/clinic/data/members";
import { getCurrentMember, hasPermission } from "@/features/clinic/data/current-member";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getClinicOptions } from "@/features/clinic/data/clinic-options";
import { getBusinessHours } from "@/features/clinic/data/business-hours";

type Section = { value: string; label: string; icon: LucideIcon };

/** Configuración's sections, grouped by what they're about. The values
 * are the `?tab=` of links into a section. */
const GROUPS: { title: string; sections: Section[] }[] = [
  {
    title: "Consultorio",
    sections: [
      {
        value: "clinic",
        label: "Datos del consultorio",
        icon: Building2,
      },
      {
        value: "hours",
        label: "Horario de atención",
        icon: Clock,
      },
    ],
  },
  {
    title: "Equipo",
    sections: [
      {
        value: "team",
        label: "Equipo",
        icon: UsersRound,
      },
      {
        value: "professionals",
        label: "Profesionales",
        icon: UserRound,
      },
    ],
  },
  {
    title: "Catálogos",
    sections: [
      {
        value: "treatment",
        label: "Tratamientos",
        icon: Stethoscope,
      },
      {
        value: "specialty",
        label: "Especialidades",
        icon: Layers,
      },
      {
        value: "insurance",
        label: "Obras sociales",
        icon: ShieldPlus,
      },
    ],
  },
];

const SECTIONS = GROUPS.flatMap((g) => g.sections);


export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  if (!(await hasPermission("settings.manage"))) return <NoPermission what="la configuración" />;
  const clinic = await getCurrentClinic();
  const [insuranceOptions, treatmentOptions, specialtyOptions, businessHours, professionals, members, invitations] =
    clinic
      ? await Promise.all([
          getClinicOptions(clinic.id, "insurance"),
          getClinicOptions(clinic.id, "treatment"),
          getClinicOptions(clinic.id, "specialty"),
          getBusinessHours(clinic.id),
          getProfessionals(clinic.id),
          getMembers(clinic.id),
          getInvitations(clinic.id),
        ])
      : [[], [], [], [], [], [], []];
  const me = (await getCurrentMember())?.member;
  const initial = SECTIONS.some((s) => s.value === tab) ? tab! : "clinic";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configuración" description="Todo lo propio de tu consultorio." icon={Settings} />

      <Tabs
        defaultValue={initial}
        orientation="vertical"
        className="flex-col gap-6 lg:grid lg:grid-cols-[15rem_1fr] lg:items-start"
      >
        <TabsList
          aria-label="Secciones de la configuración"
          className="h-auto w-full flex-row flex-wrap items-stretch justify-start gap-1.5 bg-transparent p-0 group-data-vertical/tabs:h-auto group-data-vertical/tabs:flex-row lg:group-data-vertical/tabs:flex-col lg:sticky lg:top-4 lg:flex-col lg:flex-nowrap lg:gap-4 lg:rounded-xl lg:border lg:bg-card lg:p-3"
        >
          {GROUPS.map((group) => (
            <div key={group.title} className="contents lg:flex lg:flex-col lg:gap-0.5">
              <p className="hidden px-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase lg:block">
                {group.title}
              </p>
              {group.sections.map((s) => (
                <TabsTrigger
                  key={s.value}
                  value={s.value}
                  className="h-9 flex-none justify-start gap-2 rounded-full border border-border bg-card px-3 text-sm group-data-vertical/tabs:w-auto lg:rounded-md lg:border-transparent lg:bg-transparent lg:px-2 lg:group-data-vertical/tabs:w-full data-active:border-primary/30 lg:data-active:border-transparent data-active:bg-primary/10 data-active:text-primary data-active:shadow-none dark:data-active:border-transparent dark:data-active:bg-primary/15 dark:data-active:text-primary"
                >
                  <s.icon />
                  {s.label}
                </TabsTrigger>
              ))}
            </div>
          ))}
        </TabsList>

        <div className="min-w-0">
          <TabsContent value="clinic">
            {clinic && (
              <ClinicDetailsCard
                clinic={{ name: clinic.name, address: clinic.address, phone: clinic.phone, email: clinic.email }}
              />
            )}
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
            <ProfessionalsManager professionals={professionals} specialties={specialtyOptions.map((o) => o.label)} />
          </TabsContent>
          <TabsContent value="treatment">
            <TreatmentCatalog treatments={treatmentOptions} specialties={specialtyOptions.map((o) => o.label)} />
          </TabsContent>
          <TabsContent value="specialty">
            <OptionListManager
              category="specialty"
              title="Especialidades"
              description="Agrupan los tratamientos del catálogo (y sus contadores)."
              options={specialtyOptions}
            />
          </TabsContent>
          <TabsContent value="insurance">
            <OptionListManager
              category="insurance"
              title="Obras sociales"
              description="Las opciones disponibles al cargar un paciente."
              options={insuranceOptions}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
