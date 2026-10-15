import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SuppliesTable } from "@/features/stock/components/supplies-table";
import { NewSupplyButton } from "@/features/stock/components/supply-actions";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getSupplies } from "@/features/clinic/data/supplies";

export default async function StockPage() {
  const clinic = await getCurrentClinic();
  const supplies = clinic ? await getSupplies(clinic.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Stock"
        description="Insumos del consultorio: precio, unidad y cantidad disponible."
        icon={Boxes}
        action={<NewSupplyButton />}
      />
      <SuppliesTable supplies={supplies} />
    </div>
  );
}
