"use server";

import { requirePermission } from "@/features/clinic/data/current-member";
import { runAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import {
  createSupply,
  deleteSupply,
  restockSupply,
  updateSupply,
  type NewSupplyInput,
  type UpdateSupplyInput,
} from "@/features/clinic/data/supplies";


export async function createSupplyAction(input: NewSupplyInput) {
  return runAction(async () => {
    const clinicId = await requirePermission("stock.manage");
    const supply = await createSupply(clinicId, input);
    revalidatePath("/dashboard/stock");
    return supply;
  });
}

export async function updateSupplyAction(id: string, input: UpdateSupplyInput) {
  return runAction(async () => {
    const clinicId = await requirePermission("stock.manage");
    const supply = await updateSupply(clinicId, id, input);
    revalidatePath("/dashboard/stock");
    return supply;
  });
}

export async function restockSupplyAction(id: string, amount: number) {
  return runAction(async () => {
    const clinicId = await requirePermission("stock.manage");
    const supply = await restockSupply(clinicId, id, amount);
    revalidatePath("/dashboard/stock");
    return supply;
  });
}

export async function deleteSupplyAction(id: string) {
  return runAction(async () => {
    const clinicId = await requirePermission("stock.manage");
    await deleteSupply(clinicId, id);
    revalidatePath("/dashboard/stock");
  });
}
