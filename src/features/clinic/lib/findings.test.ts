import { describe, expect, it } from "vitest";
import {
  CONDITIONS,
  findingCounts,
  toothStatus,
  isSurfaceCondition,
  surfaceLabel,
  surfaceSide,
} from "@/features/clinic/lib/findings";

describe("tooth surfaces", () => {
  it("names the chewing surface incisal on front teeth and oclusal on back ones", () => {
    expect(surfaceLabel("11", "O")).toBe("Incisal");
    expect(surfaceLabel("13", "O")).toBe("Incisal");
    expect(surfaceLabel("14", "O")).toBe("Oclusal");
    expect(surfaceLabel("55", "O")).toBe("Oclusal");
  });

  it("names the inner surface palatina on upper teeth and lingual on lower ones", () => {
    expect(surfaceLabel("16", "L")).toBe("Palatina");
    expect(surfaceLabel("62", "L")).toBe("Palatina");
    expect(surfaceLabel("46", "L")).toBe("Lingual");
    expect(surfaceLabel("16", "V")).toBe("Vestibular");
    expect(surfaceLabel("16", "M")).toBe("Mesial");
    expect(surfaceLabel("16", "D")).toBe("Distal");
  });

  it("draws vestibular towards the lips and mesial towards the midline, as the chart faces the patient", () => {
    // Upper right (quadrant 1) is on the chart's left: midline to its right.
    expect(surfaceSide("16", "V")).toBe("top");
    expect(surfaceSide("16", "L")).toBe("bottom");
    expect(surfaceSide("16", "M")).toBe("right");
    expect(surfaceSide("16", "D")).toBe("left");
    // Upper left (quadrant 2) is on the chart's right: midline to its left.
    expect(surfaceSide("26", "M")).toBe("left");
    // Lower teeth have their lips below.
    expect(surfaceSide("36", "V")).toBe("bottom");
    expect(surfaceSide("36", "M")).toBe("left");
    expect(surfaceSide("46", "M")).toBe("right");
    expect(surfaceSide("85", "M")).toBe("right");
    expect(surfaceSide("46", "O")).toBe("center");
  });
});

describe("conditions", () => {
  it("knows which conditions go on a surface and which on the whole tooth", () => {
    expect(isSurfaceCondition("caries")).toBe(true);
    expect(isSurfaceCondition("restauracion")).toBe(true);
    expect(isSurfaceCondition("corona")).toBe(false);
    expect(isSurfaceCondition("ausente")).toBe(false);
    expect(CONDITIONS.caries.defaultStatus).toBe("PENDING");
    expect(CONDITIONS.restauracion.defaultStatus).toBe("DONE");
  });

  it("counts what's left to do, what's done, and the missing teeth", () => {
    const counts = findingCounts([
      { tooth: "16", condition: "caries", status: "PENDING" },
      { tooth: "16", condition: "caries", status: "DONE" },
      { tooth: "17", condition: "restauracion", status: "DONE" },
      { tooth: "46", condition: "ausente", status: "DONE" },
      { tooth: "46", condition: "ausente", status: "DONE" },
      { tooth: "36", condition: "extraccion", status: "PENDING" },
    ]);
    expect(counts).toEqual({ pending: 2, done: 2, missingTeeth: 1 });
  });
});

describe("toothStatus", () => {
  const f = (condition: string, status: "PENDING" | "DONE") => ({ tooth: "16", condition, status });

  it("sums up a whole tooth: missing, something still to do, or all done", () => {
    expect(toothStatus([])).toBeNull();
    expect(toothStatus([f("restauracion", "DONE"), f("caries", "PENDING")])).toBe("PENDING");
    expect(toothStatus([f("restauracion", "DONE"), f("corona", "DONE")])).toBe("DONE");
    expect(toothStatus([f("ausente", "DONE"), f("caries", "PENDING")])).toBe("MISSING");
  });
});
