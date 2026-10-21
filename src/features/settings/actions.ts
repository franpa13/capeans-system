"use server";

import { runAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import {
  createClinicOption,
  createTreatment,
  deleteClinicOption,
  updateClinicOption,
  updateTreatment,
  type OptionCategory,
  type TreatmentInput,
} from "@/features/clinic/data/clinic-options";
import {
  createProfessional,
  deleteProfessional,
  updateProfessional,
  type ProfessionalInput,
} from "@/features/clinic/data/professionals";
import { updateClinicDetails } from "@/features/clinic/data/clinic-details";
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

export async function createTreatmentAction(input: TreatmentInput) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    const treatment = await createTreatment(clinicId, input);
    revalidatePath("/dashboard/configuracion");
    return treatment;
  });
}

export async function updateTreatmentAction(id: string, input: TreatmentInput) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    const treatment = await updateTreatment(clinicId, id, input);
    revalidatePath("/dashboard/configuracion");
    return treatment;
  });
}

export async function createProfessionalAction(input: ProfessionalInput) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    await createProfessional(clinicId, input);
    revalidatePath("/dashboard/configuracion");
  });
}

export async function updateProfessionalAction(id: string, input: ProfessionalInput) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    await updateProfessional(clinicId, id, input);
    revalidatePath("/dashboard/configuracion");
  });
}

export async function deleteProfessionalAction(id: string) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    await deleteProfessional(clinicId, id);
    revalidatePath("/dashboard/configuracion");
  });
}

export async function updateClinicDetailsAction(input: { address?: string; phone?: string; email?: string }) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    await updateClinicDetails(clinicId, input);
    revalidatePath("/dashboard/configuracion");
  });
}
