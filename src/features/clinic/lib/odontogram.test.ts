import { describe, expect, it } from "vitest";
import {
  ALL_TEETH,
  cameraFocusFor,
  findToothPosition,
  isValidToothFdi,
  LOWER_ARCH,
  outwardDirection,
  positionOnArch,
  PRIMARY_LOWER_ARCH,
  PRIMARY_TEETH,
  PRIMARY_UPPER_ARCH,
  toothType,
  UPPER_ARCH,
} from "./odontogram";

describe("FDI tooth numbering", () => {
  it("has 32 teeth total, 16 upper and 16 lower", () => {
    expect(ALL_TEETH).toHaveLength(32);
    expect(UPPER_ARCH).toHaveLength(16);
    expect(LOWER_ARCH).toHaveLength(16);
  });

  it("has no duplicate FDI numbers", () => {
    const seen = new Set(ALL_TEETH.map((t) => t.fdi));
    expect(seen.size).toBe(32);
  });

  it("upper arch reads 18..11 then 21..28, left to right", () => {
    expect(UPPER_ARCH.map((t) => t.fdi)).toEqual([
      "18", "17", "16", "15", "14", "13", "12", "11",
      "21", "22", "23", "24", "25", "26", "27", "28",
    ]);
  });

  it("lower arch reads 48..41 then 31..38, left to right (aligned under the upper row)", () => {
    expect(LOWER_ARCH.map((t) => t.fdi)).toEqual([
      "48", "47", "46", "45", "44", "43", "42", "41",
      "31", "32", "33", "34", "35", "36", "37", "38",
    ]);
  });

  it("recognizes a valid FDI number", () => {
    expect(isValidToothFdi("16")).toBe(true);
    expect(isValidToothFdi("48")).toBe(true);
  });

  it("rejects an invalid FDI number", () => {
    expect(isValidToothFdi("99")).toBe(false);
    expect(isValidToothFdi("19")).toBe(false); // quadrant 1 only goes to 8
    expect(isValidToothFdi("")).toBe(false);
  });
});

describe("primary (baby) teeth numbering", () => {
  it("has 20 primary teeth total, 10 upper and 10 lower", () => {
    expect(PRIMARY_TEETH).toHaveLength(20);
    expect(PRIMARY_UPPER_ARCH).toHaveLength(10);
    expect(PRIMARY_LOWER_ARCH).toHaveLength(10);
  });

  it("has no duplicate FDI numbers, and none overlap with the permanent set", () => {
    const seen = new Set(PRIMARY_TEETH.map((t) => t.fdi));
    expect(seen.size).toBe(20);
    for (const tooth of PRIMARY_TEETH) {
      expect(ALL_TEETH.some((t) => t.fdi === tooth.fdi)).toBe(false);
    }
  });

  it("upper arch reads 55..51 then 61..65, left to right", () => {
    expect(PRIMARY_UPPER_ARCH.map((t) => t.fdi)).toEqual([
      "55", "54", "53", "52", "51",
      "61", "62", "63", "64", "65",
    ]);
  });

  it("lower arch reads 85..81 then 71..75, left to right (aligned under the upper row)", () => {
    expect(PRIMARY_LOWER_ARCH.map((t) => t.fdi)).toEqual([
      "85", "84", "83", "82", "81",
      "71", "72", "73", "74", "75",
    ]);
  });

  it("recognizes a valid primary FDI number", () => {
    expect(isValidToothFdi("55")).toBe(true);
    expect(isValidToothFdi("71")).toBe(true);
  });

  it("rejects an invalid primary FDI number", () => {
    expect(isValidToothFdi("56")).toBe(false); // primary quadrants only go to 5
    expect(isValidToothFdi("91")).toBe(false);
  });
});

describe("toothType", () => {
  it("classifies positions 1-2 as incisors", () => {
    expect(toothType(1)).toBe("incisor");
    expect(toothType(2)).toBe("incisor");
  });

  it("classifies position 3 as a canine", () => {
    expect(toothType(3)).toBe("canine");
  });

  it("classifies positions 4-5 as premolars", () => {
    expect(toothType(4)).toBe("premolar");
    expect(toothType(5)).toBe("premolar");
  });

  it("classifies positions 6-8 as molars", () => {
    expect(toothType(6)).toBe("molar");
    expect(toothType(7)).toBe("molar");
    expect(toothType(8)).toBe("molar");
  });
});

describe("positionOnArch", () => {
  it("places the leftmost and rightmost upper teeth symmetrically, roughly matching the real model's measured width", () => {
    const first = positionOnArch(0, 16, "upper");
    const last = positionOnArch(15, 16, "upper");
    expect(first.x).toBeCloseTo(-last.x, 1);
    expect(Math.abs(first.x)).toBeGreaterThan(0.7);
  });

  it("places the center teeth furthest forward (highest z) in both arches", () => {
    const centerUpper = positionOnArch(7, 16, "upper");
    const edgeUpper = positionOnArch(0, 16, "upper");
    expect(centerUpper.z).toBeGreaterThan(edgeUpper.z);

    const centerLower = positionOnArch(7, 16, "lower");
    const edgeLower = positionOnArch(0, 16, "lower");
    expect(centerLower.z).toBeGreaterThan(edgeLower.z);
  });

  it("curls the wisdom teeth back behind the arch's own midpoint (negative z) — the real jaw doesn't keep curving forward the way a simple ellipse would", () => {
    expect(positionOnArch(0, 16, "upper").z).toBeLessThan(0);
    expect(positionOnArch(15, 16, "upper").z).toBeLessThan(0);
    expect(positionOnArch(0, 16, "lower").z).toBeLessThan(0);
    expect(positionOnArch(15, 16, "lower").z).toBeLessThan(0);
  });

  it("keeps the center of each arch clearly above/below y=0 — the wisdom teeth sit close to y=0 so aren't a reliable sign check", () => {
    for (let i = 5; i <= 10; i++) {
      expect(positionOnArch(i, 16, "upper").y).toBeGreaterThan(0);
      expect(positionOnArch(i, 16, "lower").y).toBeLessThan(0);
    }
  });
});

describe("outwardDirection", () => {
  it("points mostly along +z for a front tooth (the arch's center)", () => {
    const { x, z } = outwardDirection(7, "upper");
    expect(z).toBeGreaterThan(Math.abs(x));
  });

  it("points backward (negative z) for a wisdom tooth, not forward", () => {
    // This is the regression the real-mesh positions fix: the ellipse
    // this replaced assumed the arch keeps curving forward at the edges
    // (positive z) the way a smooth oval would. The real jaw curls back
    // in behind its own widest point instead.
    expect(outwardDirection(0, "upper").z).toBeLessThan(0);
    expect(outwardDirection(15, "upper").z).toBeLessThan(0);
    expect(outwardDirection(0, "lower").z).toBeLessThan(0);
    expect(outwardDirection(15, "lower").z).toBeLessThan(0);
  });

  it("is a unit vector at every position in the row", () => {
    for (let i = 0; i < 16; i++) {
      const upper = outwardDirection(i, "upper");
      expect(upper.x * upper.x + upper.z * upper.z).toBeCloseTo(1, 10);
      const lower = outwardDirection(i, "lower");
      expect(lower.x * lower.x + lower.z * lower.z).toBeCloseTo(1, 10);
    }
  });
});

describe("findToothPosition", () => {
  it("finds an upper tooth's position matching positionOnArch", () => {
    expect(findToothPosition("11")).toEqual(positionOnArch(7, 16, "upper"));
  });

  it("finds a lower tooth's position matching positionOnArch", () => {
    expect(findToothPosition("31")).toEqual(positionOnArch(8, 16, "lower"));
  });

  it("returns null for an invalid FDI number", () => {
    expect(findToothPosition("99")).toBeNull();
  });
});

describe("cameraFocusFor", () => {
  it("returns null for an invalid FDI number", () => {
    expect(cameraFocusFor("99")).toBeNull();
  });

  it("targets the tooth's own position", () => {
    const focus = cameraFocusFor("21");
    expect(focus?.target).toEqual(findToothPosition("21"));
  });

  it("pulls the camera back mostly along z for a front tooth (an incisor)", () => {
    const focus = cameraFocusFor("11")!;
    const dx = Math.abs(focus.cameraPosition.x - focus.target.x);
    const dz = Math.abs(focus.cameraPosition.z - focus.target.z);
    expect(dz).toBeGreaterThan(dx);
  });

  it("pulls the camera back and away from the arch's center for a wisdom tooth, unlike a fixed +z pullback would", () => {
    // Old regression this guards differently now: a fixed +z pullback
    // looked at the side/back of edge teeth instead of their face. Now
    // that the position itself comes from the real mesh, the real pullback
    // direction for a wisdom tooth points backward (negative z, see the
    // outwardDirection tests) rather than forward — the opposite of what
    // a +z pullback would do.
    const focus = cameraFocusFor("18")!;
    expect(focus.cameraPosition.z).toBeLessThan(focus.target.z);
  });
});
