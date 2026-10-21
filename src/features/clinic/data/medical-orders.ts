import { prisma } from "@/lib/prisma";
import type { MedicalOrder, Patient } from "@prisma/client";
import { isOrderKind } from "@/features/clinic/lib/orders";
import { signedBy } from "@/features/clinic/data/professionals";

export type NewMedicalOrderInput = {
  professionalId: string;
  kind: string;
  items: string[];
  diagnosis?: string;
  notes?: string;
};

/** Issues an orden, numbered next in the clinic, signed by the
 * professional as they are now. */
export async function createMedicalOrder(
  clinicId: string,
  patientId: string,
  input: NewMedicalOrderInput,
): Promise<MedicalOrder> {
  if (!isOrderKind(input.kind)) throw new Error("Elegí el tipo de orden");
  const items = input.items.map((i) => i.trim()).filter(Boolean);
  if (items.length === 0) throw new Error("Agregá al menos un estudio o derivación");
  const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId } });
  if (!patient) throw new Error("Patient not found for this clinic");
  const professional = await prisma.professional.findFirst({
    where: { id: input.professionalId, clinicId },
  });
  if (!professional) throw new Error("Elegí el profesional que firma la orden");

  return prisma.$transaction(async (tx) => {
    const last = await tx.medicalOrder.aggregate({ where: { clinicId }, _max: { number: true } });
    return tx.medicalOrder.create({
      data: {
        clinicId,
        patientId,
        professionalId: professional.id,
        number: (last._max.number ?? 0) + 1,
        kind: input.kind,
        items,
        diagnosis: input.diagnosis?.trim() || null,
        notes: input.notes?.trim() || null,
        ...signedBy(professional),
      },
    });
  });
}

/** The patient's órdenes, newest first. */
export async function getPatientMedicalOrders(clinicId: string, patientId: string): Promise<MedicalOrder[]> {
  return prisma.medicalOrder.findMany({ where: { clinicId, patientId }, orderBy: { number: "desc" } });
}

export async function getMedicalOrder(
  clinicId: string,
  id: string,
): Promise<(MedicalOrder & { patient: Patient }) | null> {
  return prisma.medicalOrder.findFirst({ where: { id, clinicId }, include: { patient: true } });
}

export async function deleteMedicalOrder(clinicId: string, id: string): Promise<void> {
  const result = await prisma.medicalOrder.deleteMany({ where: { id, clinicId } });
  if (result.count === 0) throw new Error("Order not found for this clinic");
}
