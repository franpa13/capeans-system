// Liquidaciones: what each professional earns for a period, as a
// percentage of what was actually collected (paid) for their consultas in
// it — never of what's still owed.

export type LiquidationMode = "PROFESSIONAL" | "TREATMENT";

export const LIQUIDATION_MODES: Record<LiquidationMode, { label: string; description: string }> = {
  PROFESSIONAL: {
    label: "% del profesional",
    description: "El % configurado en el profesional, sobre todo lo cobrado.",
  },
  TREATMENT: {
    label: "% por tratamiento",
    description: "El % de cada tratamiento (o el del profesional si no tiene) sobre lo cobrado de ese tratamiento.",
  },
};

export function isLiquidationMode(value: string): value is LiquidationMode {
  return value in LIQUIDATION_MODES;
}

export type LiquidationSourceLine = {
  consultationId: string;
  date: Date;
  patientName: string;
  treatment: string;
  /** Paid for this consulta within the period. */
  collected: number;
  /** The tratamiento's own %, if it has one. */
  treatmentPercent: number | null;
};

export type LiquidationLine = LiquidationSourceLine & {
  percent: number;
  /** Where the % came from — shown so the dentist can check it. */
  percentSource: "professional" | "treatment" | "none";
  commission: number;
};

export function computeLiquidation({
  mode,
  professionalPercent,
  lines,
}: {
  mode: LiquidationMode;
  professionalPercent: number | null;
  lines: LiquidationSourceLine[];
}) {
  const computed: LiquidationLine[] = lines.map((line) => {
    const fromTreatment = mode === "TREATMENT" && line.treatmentPercent != null;
    const percent = fromTreatment ? line.treatmentPercent! : (professionalPercent ?? 0);
    const percentSource = fromTreatment ? "treatment" : professionalPercent != null ? "professional" : "none";
    return { ...line, percent, percentSource, commission: Math.round((line.collected * percent) / 100) };
  });
  return {
    lines: computed,
    totalCollected: computed.reduce((sum, l) => sum + l.collected, 0),
    totalCommission: computed.reduce((sum, l) => sum + l.commission, 0),
  };
}

/** "LIQ-00007" — how a liquidación is numbered. */
export function liquidationNumber(n: number): string {
  return `LIQ-${String(n).padStart(5, "0")}`;
}

/** A commission % is a whole number from 0 to 100, or not set. */
export function assertValidCommission(percent: number | null | undefined) {
  if (percent == null) return;
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new Error("La comisión tiene que ser un número entero entre 0 y 100");
  }
}
