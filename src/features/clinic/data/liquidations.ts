import { prisma } from "@/lib/prisma";
import type { Liquidation, Prisma } from "@prisma/client";
import {
  computeLiquidation,
  isLiquidationMode,
  type LiquidationLine,
  type LiquidationMode,
  type LiquidationSourceLine,
} from "@/features/clinic/lib/liquidations";
import { formatDate, toLocalDateString } from "@/features/clinic/lib/format";

export type LiquidationInput = {
  professionalId: string;
  /** "YYYY-MM-DD", local days, both included. */
  from: string;
  to: string;
  mode: string;
};

export type LiquidationWithLines = Omit<Liquidation, "lines"> & { lines: LiquidationLine[] };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function periodOf(from: string, to: string) {
  if (!DAY.test(from) || !DAY.test(to)) throw new Error("Elegí las fechas desde y hasta");
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (end < start) throw new Error("La fecha hasta tiene que ser igual o posterior a la desde");
  end.setDate(end.getDate() + 1);
  return { start, end };
}

const withLines = (l: Liquidation): LiquidationWithLines => ({
  ...l,
  lines: l.lines as unknown as LiquidationLine[],
});

/** What a liquidación would be: the professional's consultas' payments
 * collected in the period, per consulta, with each line's % and commission. */
export async function getLiquidationPreview(clinicId: string, input: LiquidationInput) {
  if (!isLiquidationMode(input.mode)) throw new Error("Elegí el modo de cálculo");
  const mode: LiquidationMode = input.mode;
  const professional = await prisma.professional.findFirst({ where: { id: input.professionalId, clinicId } });
  if (!professional) throw new Error("Elegí un profesional del consultorio");
  const { start, end } = periodOf(input.from, input.to);

  const payments = await prisma.payment.findMany({
    where: { clinicId, paidAt: { gte: start, lt: end }, consultation: { professionalId: professional.id } },
    include: {
      consultation: { select: { id: true, date: true, treatment: true, patient: { select: { name: true } } } },
    },
    orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
  });
  const treatments = await prisma.clinicOption.findMany({ where: { clinicId, category: "treatment" } });
  const percentByTreatment = new Map(treatments.map((t) => [t.label, t.commissionPercent]));

  const byConsultation = new Map<string, LiquidationSourceLine>();
  for (const p of payments) {
    const c = p.consultation;
    const line = byConsultation.get(c.id);
    if (line) line.collected += p.amount;
    else
      byConsultation.set(c.id, {
        consultationId: c.id,
        date: c.date,
        patientName: c.patient?.name ?? "Paciente eliminado",
        treatment: c.treatment,
        collected: p.amount,
        treatmentPercent: percentByTreatment.get(c.treatment) ?? null,
      });
  }

  return {
    professional,
    professionalName: `${professional.title} ${professional.name}`,
    mode,
    periodFrom: start,
    periodTo: end,
    ...computeLiquidation({
      mode,
      professionalPercent: professional.commissionPercent,
      lines: [...byConsultation.values()],
    }),
  };
}

/** "dd/mm/aaaa" of a period's first day, or of its last (periodTo is the
 * day after it). */
export const periodDay = (d: Date) => formatDate(toLocalDateString(d))!;
export const periodLastDay = (periodTo: Date) => periodDay(new Date(periodTo.getTime() - DAY_MS));

/** Saves the liquidación as calculated, numbered next in the clinic. A
 * professional's periods can't overlap: nothing is ever paid twice. */
export async function createLiquidation(clinicId: string, input: LiquidationInput): Promise<LiquidationWithLines> {
  const preview = await getLiquidationPreview(clinicId, input);
  return prisma.$transaction(async (tx) => {
    const overlapping = await tx.liquidation.findFirst({
      where: {
        clinicId,
        professionalId: preview.professional.id,
        periodFrom: { lt: preview.periodTo },
        periodTo: { gt: preview.periodFrom },
      },
    });
    if (overlapping) {
      throw new Error(
        `Ya hay una liquidación de ${preview.professionalName} del ${periodDay(overlapping.periodFrom)} al ` +
          `${periodLastDay(overlapping.periodTo)}. Elegí otro período o eliminá esa liquidación.`,
      );
    }
    if (preview.lines.length === 0) {
      throw new Error(`No hay cobros de ${preview.professionalName} en ese período`);
    }
    const last = await tx.liquidation.aggregate({ where: { clinicId }, _max: { number: true } });
    const created = await tx.liquidation.create({
      data: {
        clinicId,
        professionalId: preview.professional.id,
        professionalName: preview.professionalName,
        number: (last._max.number ?? 0) + 1,
        periodFrom: preview.periodFrom,
        periodTo: preview.periodTo,
        mode: preview.mode,
        lines: preview.lines as unknown as Prisma.InputJsonValue,
        totalCollected: preview.totalCollected,
        totalCommission: preview.totalCommission,
      },
    });
    return withLines(created);
  });
}

/** The clinic's liquidaciones, newest first. */
export async function getLiquidations(
  clinicId: string,
  filters: { professionalId?: string; mode?: string },
): Promise<LiquidationWithLines[]> {
  const list = await prisma.liquidation.findMany({
    where: {
      clinicId,
      ...(filters.professionalId ? { professionalId: filters.professionalId } : {}),
      ...(filters.mode ? { mode: filters.mode } : {}),
    },
    orderBy: { number: "desc" },
  });
  return list.map(withLines);
}

export async function getLiquidation(clinicId: string, id: string): Promise<LiquidationWithLines | null> {
  const found = await prisma.liquidation.findFirst({ where: { id, clinicId } });
  return found ? withLines(found) : null;
}

/** Marks it paid to the professional (now), or back to pending. */
export async function setLiquidationPaid(clinicId: string, id: string, paid: boolean): Promise<Liquidation> {
  const result = await prisma.liquidation.updateMany({
    where: { id, clinicId },
    data: { paidAt: paid ? new Date() : null },
  });
  if (result.count === 0) throw new Error("Liquidation not found for this clinic");
  return prisma.liquidation.findUniqueOrThrow({ where: { id } });
}

export async function deleteLiquidation(clinicId: string, id: string): Promise<void> {
  const result = await prisma.liquidation.deleteMany({ where: { id, clinicId } });
  if (result.count === 0) throw new Error("Liquidation not found for this clinic");
}
