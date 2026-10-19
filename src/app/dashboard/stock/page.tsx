import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ExcelDownloadButton } from "@/features/excel/components/excel-download-button";
import { ImportExcelDialog } from "@/features/excel/components/import-excel-dialog";
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
        action={
          <div className="flex flex-wrap gap-2">
            <ImportExcelDialog kind="insumos" />
            <ExcelDownloadButton path="/api/excel/stock" />
            <NewSupplyButton />
          </div>
        }
      />
      <SuppliesTable supplies={supplies} />
    </div>
  );
}
