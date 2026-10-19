import { prisma } from "@/lib/prisma";
import { createPatient, type NewPatientInput } from "@/features/clinic/data/patients";
import { createSupply, type NewSupplyInput } from "@/features/clinic/data/supplies";
import { createClinicOption, updateClinicOption } from "@/features/clinic/data/clinic-options";
import type { RowError } from "@/features/excel/lib/imports";

type Item<T> = { rowNumber: number; input: T };

/** What an Excel import did, row by row — shown to the dentist as is. */
export type ImportResult = {
  created: number;
  updated: number;
  /** Rows not loaded because they were already there. */
  skipped: RowError[];
  /** Rows refused by the same validation as the forms. */
  errors: RowError[];
};

function emptyResult(): ImportResult {
  return { created: 0, updated: 0, skipped: [], errors: [] };
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo cargar";
}

const personKey = (name: string, phone: string) =>
  `${name.trim().toLowerCase()}|${phone.replace(/\D/g, "")}`;

/** Loads patients without duplicating: one with the same DNI, or the same
 * name and phone, as an existing patient (or an earlier row) is skipped. */
export async function importPatients(
  clinicId: string,
  items: Item<NewPatientInput>[],
): Promise<ImportResult> {
  const existing = await prisma.patient.findMany({
    where: { clinicId },
    select: { name: true, phone: true, dni: true },
  });
  const dnis = new Set(existing.flatMap((p) => (p.dni ? [p.dni.replace(/\D/g, "")] : [])));
  const people = new Set(existing.map((p) => personKey(p.name, p.phone)));
  const result = emptyResult();

  for (const { rowNumber, input } of items) {
    const dni = input.dni?.replace(/\D/g, "");
    const key = personKey(input.name, input.phone);
    if (dni && dnis.has(dni)) {
      result.skipped.push({ row: rowNumber, message: `Ya existe un paciente con el DNI ${input.dni}` });
      continue;
    }
    if (people.has(key)) {
      result.skipped.push({ row: rowNumber, message: `Ya existe ${input.name} con ese teléfono` });
      continue;
    }
    try {
      await createPatient(clinicId, input);
      result.created++;
      if (dni) dnis.add(dni);
      people.add(key);
    } catch (error) {
      result.errors.push({ row: rowNumber, message: messageOf(error) });
    }
  }
  return result;
}

/** Loads insumos; a name that already exists is left as it is. */
export async function importSupplies(
  clinicId: string,
  items: Item<NewSupplyInput>[],
): Promise<ImportResult> {
  const names = new Set(
    (await prisma.supply.findMany({ where: { clinicId }, select: { name: true } })).map((s) => s.name),
  );
  const result = emptyResult();
  for (const { rowNumber, input } of items) {
    if (names.has(input.name)) {
      result.skipped.push({ row: rowNumber, message: `Ya existe ${input.name}` });
      continue;
    }
    try {
      await createSupply(clinicId, input);
      names.add(input.name);
      result.created++;
    } catch (error) {
      result.errors.push({ row: rowNumber, message: messageOf(error) });
    }
  }
  return result;
}

/** Loads tratamientos, or updates the list price of ones already there —
 * the way to bring a whole new price list in at once. */
export async function importTreatments(
  clinicId: string,
  items: Item<{ label: string; price: number | undefined }>[],
): Promise<ImportResult> {
  const existing = new Map(
    (
      await prisma.clinicOption.findMany({
        where: { clinicId, category: "treatment" },
        select: { id: true, label: true },
      })
    ).map((o) => [o.label, o.id]),
  );
  const result = emptyResult();
  for (const { rowNumber, input } of items) {
    try {
      const id = existing.get(input.label);
      if (id) {
        if (input.price === undefined) {
          result.skipped.push({
            row: rowNumber,
            message: `${input.label} ya existe (sin precio para actualizar)`,
          });
          continue;
        }
        await updateClinicOption(clinicId, id, input.label, input.price);
        result.updated++;
      } else {
        const option = await createClinicOption(clinicId, "treatment", input.label, input.price);
        existing.set(option.label, option.id);
        result.created++;
      }
    } catch (error) {
      result.errors.push({ row: rowNumber, message: messageOf(error) });
    }
  }
  return result;
}
