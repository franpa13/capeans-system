import { prisma } from "@/lib/prisma";
import type { Patient, Prescription } from "@prisma/client";
import type { PrescriptionItem } from "@/features/clinic/lib/prescriptions";
import { signedBy } from "@/features/clinic/data/professionals";

export type NewPrescriptionInput = {
  professionalId: string;
  items: PrescriptionItem[];
  treatment?: string;
  instructions?: string;
};

export type PrescriptionWithItems = Omit<Prescription, "items"> & { items: PrescriptionItem[] };

function withItems<T extends Prescription>(p: T): Omit<T, "items"> & { items: PrescriptionItem[] } {
  return { ...p, items: p.items as unknown as PrescriptionItem[] };
}

function cleanItems(items: PrescriptionItem[]): PrescriptionItem[] {
  return items
    .map((i) => ({
      drug: i.drug.trim(),
      concentration: i.concentration.trim(),
      quantity: i.quantity.trim(),
      instructions: i.instructions.trim(),
    }))
    .filter((i) => i.drug);
}

/** Issues a receta, numbered next in the clinic, with the professional's
 * name, matrícula and signature copied in as they are now. */
export async function createPrescription(
  clinicId: string,
  patientId: string,
  input: NewPrescriptionInput,
): Promise<PrescriptionWithItems> {
  const items = cleanItems(input.items);
  if (items.length === 0) throw new Error("Agregá al menos un medicamento");
  const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId } });
  if (!patient) throw new Error("Patient not found for this clinic");
  const professional = await prisma.professional.findFirst({
    where: { id: input.professionalId, clinicId },
  });
  if (!professional) throw new Error("Elegí el profesional que firma la receta");

  const prescription = await prisma.$transaction(async (tx) => {
    const last = await tx.prescription.aggregate({ where: { clinicId }, _max: { number: true } });
    return tx.prescription.create({
      data: {
        clinicId,
        patientId,
        professionalId: professional.id,
        number: (last._max.number ?? 0) + 1,
        treatment: input.treatment?.trim() || null,
        instructions: input.instructions?.trim() || null,
        items,
        ...signedBy(professional),
      },
    });
  });
  return withItems(prescription);
}

/** The patient's recetas, newest first. */
export async function getPatientPrescriptions(
  clinicId: string,
  patientId: string,
): Promise<PrescriptionWithItems[]> {
  const list = await prisma.prescription.findMany({
    where: { clinicId, patientId },
    orderBy: { number: "desc" },
  });
  return list.map(withItems);
}

export async function getPrescription(
  clinicId: string,
  id: string,
): Promise<(PrescriptionWithItems & { patient: Patient }) | null> {
  const p = await prisma.prescription.findFirst({ where: { id, clinicId }, include: { patient: true } });
  return p ? withItems(p) : null;
}

export async function deletePrescription(clinicId: string, id: string): Promise<void> {
  const result = await prisma.prescription.deleteMany({ where: { id, clinicId } });
  if (result.count === 0) throw new Error("Prescription not found for this clinic");
}
