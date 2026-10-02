import { prisma } from "@/lib/prisma";
import type { ClinicOption } from "@prisma/client";
import { DEFAULT_INSURANCE_OPTIONS } from "@/features/clinic/lib/insurance";
import { DEFAULT_TREATMENT_OPTIONS } from "@/features/clinic/lib/treatments";

export const OPTION_CATEGORIES = ["insurance", "treatment"] as const;
export type OptionCategory = (typeof OPTION_CATEGORIES)[number];

const DEFAULTS_BY_CATEGORY: Record<OptionCategory, readonly string[]> = {
  insurance: DEFAULT_INSURANCE_OPTIONS,
  treatment: DEFAULT_TREATMENT_OPTIONS,
};

export async function getClinicOptions(
  clinicId: string,
  category: OptionCategory,
): Promise<ClinicOption[]> {
  return prisma.clinicOption.findMany({
    where: { clinicId, category },
    orderBy: [{ order: "asc" }, { label: "asc" }],
  });
}

export async function seedDefaultClinicOptions(clinicId: string): Promise<void> {
  const existing = await prisma.clinicOption.findFirst({ where: { clinicId } });
  if (existing) return;

  const rows = OPTION_CATEGORIES.flatMap((category) =>
    DEFAULTS_BY_CATEGORY[category].map((label, index) => ({
      clinicId,
      category,
      label,
      order: index,
    })),
  );

  await prisma.clinicOption.createMany({ data: rows });
}

export async function createClinicOption(
  clinicId: string,
  category: OptionCategory,
  label: string,
): Promise<ClinicOption> {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error("El nombre no puede estar vacío");
  }

  const existing = await prisma.clinicOption.findFirst({
    where: { clinicId, category, label: trimmed },
  });
  if (existing) {
    throw new Error("Ya existe una opción con ese nombre");
  }

  const last = await prisma.clinicOption.findFirst({
    where: { clinicId, category },
    orderBy: { order: "desc" },
  });

  return prisma.clinicOption.create({
    data: { clinicId, category, label: trimmed, order: (last?.order ?? -1) + 1 },
  });
}

export async function updateClinicOption(
  clinicId: string,
  id: string,
  label: string,
): Promise<ClinicOption> {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error("El nombre no puede estar vacío");
  }

  const option = await prisma.clinicOption.findFirst({ where: { id, clinicId } });
  if (!option) {
    throw new Error("Option not found for this clinic");
  }

  const duplicate = await prisma.clinicOption.findFirst({
    where: {
      clinicId,
      category: option.category,
      label: trimmed,
      id: { not: id },
    },
  });
  if (duplicate) {
    throw new Error("Ya existe una opción con ese nombre");
  }

  return prisma.clinicOption.update({
    where: { id },
    data: { label: trimmed },
  });
}

export async function deleteClinicOption(clinicId: string, id: string): Promise<void> {
  await prisma.clinicOption.deleteMany({ where: { id, clinicId } });
}
