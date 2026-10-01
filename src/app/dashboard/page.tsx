import { PageHeader } from "@/components/page-header";
import { DashboardSummary } from "@/features/dashboard/components/dashboard-summary";
import { getSession } from "@/features/auth/lib/session";

export default async function DashboardPage() {
  const session = await getSession();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Hola, ${session?.name}`}
        description="Este es el panel del consultorio. Las secciones se van a ir agregando en los próximos pasos."
      />

      <DashboardSummary />
    </div>
  );
}
