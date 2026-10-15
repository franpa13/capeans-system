"use server";

import { runAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import {
  createClinicOption,
  deleteClinicOption,
  updateClinicOption,
  type OptionCategory,
} from "@/features/clinic/data/clinic-options";
import {
  upsertBusinessHours,
  type BusinessHoursInput,
} from "@/features/clinic/data/business-hours";

async function requireClinicId(): Promise<string> {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("No hay un consultorio activo para este usuario");
  return clinic.id;
}

export async function createClinicOptionAction(
  category: OptionCategory,
  label: string,
  price?: number,
) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    const option = await createClinicOption(clinicId, category, label, price);
    revalidatePath("/dashboard/configuracion");
    return option;
  });
}

export async function updateClinicOptionAction(id: string, label: string, price?: number) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    const option = await updateClinicOption(clinicId, id, label, price);
    revalidatePath("/dashboard/configuracion");
    return option;
  });
}

export async function deleteClinicOptionAction(id: string) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    await deleteClinicOption(clinicId, id);
    revalidatePath("/dashboard/configuracion");
  });
}

export async function updateBusinessHoursAction(weekday: number, input: BusinessHoursInput) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    const hours = await upsertBusinessHours(clinicId, weekday, input);
    revalidatePath("/dashboard/configuracion");
    // The Turnos grid reads business hours too, to shade closed hours.
    revalidatePath("/dashboard/turnos");
    return hours;
  });
}
