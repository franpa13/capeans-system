import { describe, expect, it } from "vitest";
import { INSURANCE_COLORS, insuranceColor } from "@/features/clinic/lib/insurance-color";

describe("insuranceColor", () => {
  it("always gives the same obra social the same color, whatever the casing", () => {
    expect(insuranceColor("OSDE")).toBe(insuranceColor("osde "));
    expect(INSURANCE_COLORS).toContain(insuranceColor("OSDE"));
  });

  it("spreads different obras sociales over different colors", () => {
    const names = ["OSDE", "Swiss Medical", "Galeno", "PAMI", "IOMA", "Medicus"];
    expect(new Set(names.map(insuranceColor)).size).toBeGreaterThanOrEqual(4);
  });

  it("is neutral for no obra social or Particular", () => {
    expect(insuranceColor(null)).toBe("neutral");
    expect(insuranceColor("")).toBe("neutral");
    expect(insuranceColor("Particular")).toBe("neutral");
    expect(insuranceColor("Sin obra social")).toBe("neutral");
  });
});
