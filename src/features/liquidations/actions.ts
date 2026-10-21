"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action-result";
import { requirePermission } from "@/features/clinic/data/current-member";
import {
  createLiquidation,
  deleteLiquidation,
  getLiquidationPreview,
  setLiquidationPaid,
  type LiquidationInput,
} from "@/features/clinic/data/liquidations";

/** The liquidación as it would be saved, to check before saving it. */
export async function previewLiquidationAction(input: LiquidationInput) {
  return runAction(async () => {
    const clinicId = await requirePermission("income.view");
    const preview = await getLiquidationPreview(clinicId, input);
    return {
      professionalName: preview.professionalName,
      professionalPercent: preview.professional.commissionPercent,
      lines: preview.lines,
      totalCollected: preview.totalCollected,
      totalCommission: preview.totalCommission,
    };
  });
}

export async function createLiquidationAction(input: LiquidationInput) {
  return runAction(async () => {
    const clinicId = await requirePermission("income.view");
    const liquidation = await createLiquidation(clinicId, input);
    revalidatePath("/dashboard/liquidaciones");
    return { id: liquidation.id };
  });
}

export async function setLiquidationPaidAction(id: string, paid: boolean) {
  return runAction(async () => {
    const clinicId = await requirePermission("income.view");
    await setLiquidationPaid(clinicId, id, paid);
    revalidatePath("/dashboard/liquidaciones");
  });
}

export async function deleteLiquidationAction(id: string) {
  return runAction(async () => {
    const clinicId = await requirePermission("income.view");
    await deleteLiquidation(clinicId, id);
    revalidatePath("/dashboard/liquidaciones");
  });
}
