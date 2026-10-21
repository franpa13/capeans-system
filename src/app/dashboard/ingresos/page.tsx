import { Banknote } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ExcelDownloadButton } from "@/features/excel/components/excel-download-button";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getPayments } from "@/features/clinic/data/payments";
import { addDays, startOfDay } from "@/features/appointments/lib/week";
import { addMonths, parseMonthParam } from "@/features/clinic/lib/month";
import { IncomeView } from "@/features/income/components/income-view";
import { hasPermission } from "@/features/clinic/data/current-member";
import { NoPermission } from "@/components/no-permission";

export default async function IngresosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const monthStart = parseMonthParam(mes);
  const today = startOfDay(new Date());

  if (!(await hasPermission("income.view"))) return <NoPermission what="los ingresos" />;
  const clinic = await getCurrentClinic();
  const [monthPayments, todayPayments] = clinic
    ? await Promise.all([
        getPayments(clinic.id, { from: monthStart, to: addMonths(monthStart, 1) }),
        getPayments(clinic.id, { from: today, to: addDays(today, 1) }),
      ])
    : [[], []];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ingresos"
        description="Lo cobrado por día y por mes, y con qué medio de pago."
        icon={Banknote}
        action={<ExcelDownloadButton path="/api/excel/ingresos" />}
      />
      <IncomeView
        monthStart={monthStart}
        monthPayments={monthPayments}
        todayTotal={todayPayments.reduce((sum, p) => sum + p.amount, 0)}
      />
    </div>
  );
}
