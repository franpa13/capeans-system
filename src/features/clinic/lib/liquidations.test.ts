import { describe, expect, it } from "vitest";
import { computeLiquidation, liquidationNumber, LIQUIDATION_MODES } from "@/features/clinic/lib/liquidations";

const line = (collected: number, treatmentPercent: number | null, treatment = "Limpieza") => ({
  consultationId: `c-${collected}`,
  date: new Date(2026, 9, 5),
  patientName: "Ana Gómez",
  treatment,
  collected,
  treatmentPercent,
});

describe("computeLiquidation", () => {
  it("applies the professional's % to everything collected", () => {
    const result = computeLiquidation({
      mode: "PROFESSIONAL",
      professionalPercent: 40,
      lines: [line(10000, 50), line(25000, null)],
    });
    expect(result.lines.map((l) => [l.percent, l.commission, l.percentSource])).toEqual([
      [40, 4000, "professional"],
      [40, 10000, "professional"],
    ]);
    expect(result).toMatchObject({ totalCollected: 35000, totalCommission: 14000 });
  });

  it("applies each tratamiento's own %, falling back to the professional's", () => {
    const result = computeLiquidation({
      mode: "TREATMENT",
      professionalPercent: 40,
      lines: [line(10000, 50, "Implante"), line(25000, null)],
    });
    expect(result.lines.map((l) => [l.percent, l.commission, l.percentSource])).toEqual([
      [50, 5000, "treatment"],
      [40, 10000, "professional"],
    ]);
    expect(result.totalCommission).toBe(15000);
  });

  it("rounds each commission to whole pesos, and treats a missing % as 0", () => {
    const result = computeLiquidation({
      mode: "PROFESSIONAL",
      professionalPercent: null,
      lines: [line(999, null)],
    });
    expect(result.lines[0]).toMatchObject({ percent: 0, commission: 0, percentSource: "none" });
    expect(
      computeLiquidation({ mode: "PROFESSIONAL", professionalPercent: 33, lines: [line(1001, null)] }).totalCommission,
    ).toBe(330);
  });

  it("names the modes and numbers liquidaciones", () => {
    expect(LIQUIDATION_MODES.PROFESSIONAL.label).toBe("% del profesional");
    expect(LIQUIDATION_MODES.TREATMENT.label).toBe("% por tratamiento");
    expect(liquidationNumber(7)).toBe("LIQ-00007");
  });
});
