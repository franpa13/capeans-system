import { describe, expect, it } from "vitest";
import { ALL_TEETH, isValidToothFdi, LOWER_ARCH, toothType, UPPER_ARCH } from "./odontogram";

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
