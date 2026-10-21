import { prisma } from "@/lib/prisma";
import type { ClinicOption } from "@prisma/client";
import { DEFAULT_INSURANCE_OPTIONS } from "@/features/clinic/lib/insurance";
import { DEFAULT_TREATMENT_OPTIONS } from "@/features/clinic/lib/treatments";
import {
  DEFAULT_SPECIALTIES,
  DEFAULT_TREATMENT_SPECIALTY,
} from "@/features/clinic/lib/specialties";
import { assertValidCommission } from "@/features/clinic/lib/liquidations";

export const OPTION_CATEGORIES = ["insurance", "treatment", "specialty"] as const;
export type OptionCategory = (typeof OPTION_CATEGORIES)[number];

const DEFAULTS_BY_CATEGORY: Record<OptionCategory, readonly string[]> = {
  insurance: DEFAULT_INSURANCE_OPTIONS,
  treatment: DEFAULT_TREATMENT_OPTIONS,
  specialty: DEFAULT_SPECIALTIES,
};

export async function getClinicOptions(
  clinicId: string,
  category: OptionCategory,
  /** activeOnly: just the tratamientos still offered in forms. */
  { activeOnly = false }: { activeOnly?: boolean } = {},
): Promise<ClinicOption[]> {
  return prisma.clinicOption.findMany({
    where: { clinicId, category, ...(activeOnly ? { active: true } : {}) },
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
      specialty: category === "treatment" ? (DEFAULT_TREATMENT_SPECIALTY[label] ?? null) : null,
    })),
  );

  await prisma.clinicOption.createMany({ data: rows });
}

function assertValidPrice(price: number | undefined) {
  if (price == null) return;
  if (!Number.isInteger(price)) {
    throw new Error("El precio tiene que ser un número entero");
  }
  if (price < 0) {
    throw new Error("El precio no puede ser negativo");
  }
}

export async function createClinicOption(
  clinicId: string,
  category: OptionCategory,
  label: string,
  price?: number,
): Promise<ClinicOption> {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error("El nombre no puede estar vacío");
  }
  assertValidPrice(price);

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
    data: {
      clinicId,
      category,
      label: trimmed,
      order: (last?.order ?? -1) + 1,
      price: category === "treatment" ? price ?? null : null,
    },
  });
}

export async function updateClinicOption(
  clinicId: string,
  id: string,
  label: string,
  price?: number,
): Promise<ClinicOption> {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error("El nombre no puede estar vacío");
  }
  assertValidPrice(price);

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

  // An especialidad is stored on each tratamiento by its label: renaming
  // it moves them along, in the same transaction.
  if (option.category === "specialty" && option.label !== trimmed) {
    const [updated] = await prisma.$transaction([
      prisma.clinicOption.update({ where: { id }, data: { label: trimmed } }),
      prisma.clinicOption.updateMany({
        where: { clinicId, category: "treatment", specialty: option.label },
        data: { specialty: trimmed },
      }),
    ]);
    return updated;
  }

  return prisma.clinicOption.update({
    where: { id },
    data: { label: trimmed, price: option.category === "treatment" ? price ?? null : null },
  });
}

/** A tratamiento in the catalog: everything but the label is optional. */
export type TreatmentInput = {
  label: string;
  price?: number;
  cashPrice?: number;
  code?: string;
  /** The label of one of the clinic's "specialty" options. */
  specialty?: string;
  durationMinutes?: number;
  active?: boolean;
  /** The professional's % of it, for liquidaciones "por tratamiento". */
  commissionPercent?: number | null;
};

async function treatmentData(clinicId: string, input: TreatmentInput) {
  const label = input.label.trim();
  if (!label) throw new Error("El nombre no puede estar vacío");
  assertValidPrice(input.price);
  assertValidPrice(input.cashPrice);
  assertValidCommission(input.commissionPercent);
  if (
    input.durationMinutes != null &&
    (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0)
  ) {
    throw new Error("La duración tiene que ser un número entero de minutos mayor a 0");
  }
  const specialty = input.specialty?.trim() || null;
  if (specialty) {
    const known = await prisma.clinicOption.findFirst({
      where: { clinicId, category: "specialty", label: specialty },
    });
    if (!known) throw new Error("Elegí una especialidad de la lista");
  }
  return {
    label,
    price: input.price ?? null,
    cashPrice: input.cashPrice ?? null,
    code: input.code?.trim() || null,
    specialty,
    durationMinutes: input.durationMinutes ?? null,
    active: input.active ?? true,
    commissionPercent: input.commissionPercent ?? null,
  };
}

export async function createTreatment(clinicId: string, input: TreatmentInput): Promise<ClinicOption> {
  const data = await treatmentData(clinicId, input);
  const existing = await prisma.clinicOption.findFirst({
    where: { clinicId, category: "treatment", label: data.label },
  });
  if (existing) throw new Error("Ya existe un tratamiento con ese nombre");
  const last = await prisma.clinicOption.findFirst({
    where: { clinicId, category: "treatment" },
    orderBy: { order: "desc" },
  });
  return prisma.clinicOption.create({
    data: { clinicId, category: "treatment", order: (last?.order ?? -1) + 1, ...data },
  });
}

export async function updateTreatment(
  clinicId: string,
  id: string,
  input: TreatmentInput,
): Promise<ClinicOption> {
  const option = await prisma.clinicOption.findFirst({
    where: { id, clinicId, category: "treatment" },
  });
  if (!option) throw new Error("Option not found for this clinic");
  const data = await treatmentData(clinicId, input);
  const duplicate = await prisma.clinicOption.findFirst({
    where: { clinicId, category: "treatment", label: data.label, id: { not: id } },
  });
  if (duplicate) throw new Error("Ya existe un tratamiento con ese nombre");
  return prisma.clinicOption.update({ where: { id }, data });
}

export async function deleteClinicOption(clinicId: string, id: string): Promise<void> {
  const option = await prisma.clinicOption.findFirst({ where: { id, clinicId } });
  if (!option) return;
  await prisma.$transaction([
    // Its tratamientos are left without one rather than pointing at a
    // label that no longer exists.
    ...(option.category === "specialty"
      ? [
          prisma.clinicOption.updateMany({
            where: { clinicId, category: "treatment", specialty: option.label },
            data: { specialty: null },
          }),
        ]
      : []),
    prisma.clinicOption.deleteMany({ where: { id, clinicId } }),
  ]);
}
