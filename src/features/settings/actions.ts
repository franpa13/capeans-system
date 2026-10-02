"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import {
  createClinicOption,
  deleteClinicOption,
  updateClinicOption,
  type OptionCategory,
} from "@/features/clinic/data/clinic-options";

async function requireClinicId(): Promise<string> {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("No hay un consultorio activo para este usuario");
  return clinic.id;
}

export async function createClinicOptionAction(category: OptionCategory, label: string) {
  const clinicId = await requireClinicId();
  const option = await createClinicOption(clinicId, category, label);
  revalidatePath("/dashboard/configuracion");
  return option;
}

export async function updateClinicOptionAction(id: string, label: string) {
  const clinicId = await requireClinicId();
  const option = await updateClinicOption(clinicId, id, label);
  revalidatePath("/dashboard/configuracion");
  return option;
}

export async function deleteClinicOptionAction(id: string) {
  const clinicId = await requireClinicId();
  await deleteClinicOption(clinicId, id);
  revalidatePath("/dashboard/configuracion");
}
