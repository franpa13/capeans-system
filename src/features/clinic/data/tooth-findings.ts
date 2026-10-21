import { prisma } from "@/lib/prisma";
import type { Prisma, ToothFinding } from "@prisma/client";
import {
  isCondition,
  isSurface,
  isSurfaceCondition,
  type FindingStatus,
  type Surface,
} from "@/features/clinic/lib/findings";
import { isValidToothFdi } from "@/features/clinic/lib/odontogram";

export type NewToothFindingInput = {
  tooth: string;
  /** Required for a surface condition (one finding per surface); ignored
   * for a whole-tooth one. */
  surfaces?: Surface[];
  condition: string;
  status: FindingStatus;
  notes?: string;
  authorName: string | null;
};

/** The patient's hallazgos, newest first. */
export async function getToothFindings(clinicId: string, patientId: string): Promise<ToothFinding[]> {
  return prisma.toothFinding.findMany({
    where: { clinicId, patientId },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
}

export async function addToothFindings(
  clinicId: string,
  patientId: string,
  input: NewToothFindingInput,
): Promise<ToothFinding[]> {
  if (!isValidToothFdi(input.tooth)) throw new Error("Elegí una pieza válida");
  if (!isCondition(input.condition)) throw new Error("Elegí un hallazgo de la lista");
  let surfaces: (Surface | null)[] = [null];
  if (isSurfaceCondition(input.condition)) {
    const chosen = [...new Set(input.surfaces ?? [])];
    if (chosen.length === 0 || !chosen.every(isSurface)) throw new Error("Elegí al menos una cara");
    surfaces = chosen;
  }
  const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId } });
  if (!patient) throw new Error("Patient not found for this clinic");

  const notes = input.notes?.trim() || null;
  const authorName = input.authorName?.trim() || null;
  const resolvedAt = input.status === "DONE" ? new Date() : null;
  return prisma.$transaction(
    surfaces.map((surface) =>
      prisma.toothFinding.create({
        data: {
          clinicId,
          patientId,
          tooth: input.tooth,
          surface,
          condition: input.condition,
          status: input.status,
          notes,
          authorName,
          resolvedAt,
        },
      }),
    ),
  );
}

/** Marks a hallazgo done (now) or back to pending, by hand. */
export async function setToothFindingStatus(
  clinicId: string,
  id: string,
  status: FindingStatus,
): Promise<ToothFinding> {
  const finding = await prisma.toothFinding.findFirst({ where: { id, clinicId } });
  if (!finding) throw new Error("Finding not found for this clinic");
  return prisma.toothFinding.update({
    where: { id },
    data:
      status === "DONE"
        ? { status, resolvedAt: finding.resolvedAt ?? new Date() }
        : { status, resolvedAt: null, consultationId: null },
  });
}

export async function deleteToothFinding(clinicId: string, id: string): Promise<void> {
  const result = await prisma.toothFinding.deleteMany({ where: { id, clinicId } });
  if (result.count === 0) throw new Error("Finding not found for this clinic");
}

/** A consulta resolves the pending hallazgos it treated — only this
 * patient's, in this clinic. Runs in the consulta's transaction. */
export async function resolveFindings(
  tx: Prisma.TransactionClient,
  clinicId: string,
  patientId: string,
  consultation: { id: string; date: Date },
  findingIds: string[] | undefined,
) {
  if (!findingIds?.length) return;
  await tx.toothFinding.updateMany({
    where: { id: { in: findingIds }, clinicId, patientId, status: "PENDING" },
    data: { status: "DONE", resolvedAt: consultation.date, consultationId: consultation.id },
  });
}

/** Deleting a consulta undoes what it resolved: those hallazgos are
 * pending again. */
export async function unresolveFindings(tx: Prisma.TransactionClient, consultationId: string) {
  await tx.toothFinding.updateMany({
    where: { consultationId },
    data: { status: "PENDING", resolvedAt: null, consultationId: null },
  });
}
