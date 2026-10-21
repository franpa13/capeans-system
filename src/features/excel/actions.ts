"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action-result";
import { requirePermission } from "@/features/clinic/data/current-member";
import {
  importPatients,
  importSupplies,
  importTreatments,
  type ImportResult,
} from "@/features/clinic/data/imports";
import {
  parsePatientRows,
  parseSupplyRows,
  parseTreatmentRows,
} from "@/features/excel/lib/imports";
import { readSheetRows } from "@/features/excel/lib/workbook";
import type { TemplateKind } from "@/features/excel/lib/exports";

const MAX_BYTES = 5 * 1024 * 1024;

/** "Importar Excel": reads the first sheet, validates each row like the
 * forms do, loads what's new and reports the rest by row number. */
export async function importExcelAction(kind: TemplateKind, formData: FormData) {
  return runAction(async (): Promise<ImportResult> => {
    const clinic = { id: await requirePermission("data.import") };
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Elegí un archivo de Excel");
    if (file.size > MAX_BYTES) throw new Error("El archivo es muy grande (máximo 5 MB)");

    const rows = await readSheetRows(Buffer.from(await file.arrayBuffer()));
    let parsed;
    let result: ImportResult;
    if (kind === "pacientes") {
      parsed = parsePatientRows(rows);
      result = await importPatients(clinic.id, parsed.items);
      revalidatePath("/dashboard/pacientes");
    } else if (kind === "insumos") {
      parsed = parseSupplyRows(rows);
      result = await importSupplies(clinic.id, parsed.items);
      revalidatePath("/dashboard/stock");
    } else {
      parsed = parseTreatmentRows(rows);
      result = await importTreatments(clinic.id, parsed.items);
      revalidatePath("/dashboard/configuracion");
    }
    if (parsed.items.length === 0 && parsed.errors.length === 0) {
      throw new Error("El archivo no tiene filas para importar. Usá la plantilla.");
    }
    return {
      ...result,
      errors: [...parsed.errors, ...result.errors].sort((a, b) => a.row - b.row),
    };
  });
}
