import { Banknote } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getPayments } from "@/features/clinic/data/payments";
import { addDays, startOfDay } from "@/features/appointments/lib/week";
import { addMonths, parseMonthParam } from "@/features/clinic/lib/month";
import { IncomeView } from "@/features/income/components/income-view";

export default async function IngresosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const monthStart = parseMonthParam(mes);
  const today = startOfDay(new Date());

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
      />
      <IncomeView
        monthStart={monthStart}
        monthPayments={monthPayments}
        todayTotal={todayPayments.reduce((sum, p) => sum + p.amount, 0)}
      />
    </div>
  );
}
