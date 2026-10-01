import { currentUser } from "@clerk/nextjs/server";
import { PageHeader } from "@/components/page-header";
import { DashboardSummary } from "@/features/dashboard/components/dashboard-summary";

export default async function DashboardPage() {
  const user = await currentUser();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Hola, ${user?.fullName ?? ""}`}
        description="Este es el panel del consultorio. Las secciones se van a ir agregando en los próximos pasos."
      />

      <DashboardSummary />
    </div>
  );
}
