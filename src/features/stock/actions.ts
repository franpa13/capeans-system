"use server";

import { runAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import {
  createSupply,
  deleteSupply,
  restockSupply,
  updateSupply,
  type NewSupplyInput,
  type UpdateSupplyInput,
} from "@/features/clinic/data/supplies";

async function requireClinicId(): Promise<string> {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("No hay un consultorio activo para este usuario");
  return clinic.id;
}

export async function createSupplyAction(input: NewSupplyInput) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    const supply = await createSupply(clinicId, input);
    revalidatePath("/dashboard/stock");
    return supply;
  });
}

export async function updateSupplyAction(id: string, input: UpdateSupplyInput) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    const supply = await updateSupply(clinicId, id, input);
    revalidatePath("/dashboard/stock");
    return supply;
  });
}

export async function restockSupplyAction(id: string, amount: number) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    const supply = await restockSupply(clinicId, id, amount);
    revalidatePath("/dashboard/stock");
    return supply;
  });
}

export async function deleteSupplyAction(id: string) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    await deleteSupply(clinicId, id);
    revalidatePath("/dashboard/stock");
  });
}
