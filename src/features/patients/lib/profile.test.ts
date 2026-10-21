import { describe, expect, it } from "vitest";
import { ageOn, displayName, initials } from "@/features/patients/lib/profile";

describe("patient profile helpers", () => {
  it("counts the age in whole years, turning a year older on the birthday", () => {
    // Stored as UTC midnight of the date, like the patient form saves it.
    const birth = new Date("1984-12-05");
    expect(ageOn(birth, new Date(2026, 11, 4))).toBe(41);
    expect(ageOn(birth, new Date(2026, 11, 5))).toBe(42);
    expect(ageOn(null, new Date(2026, 0, 1))).toBeNull();
  });

  it("reads 'Apellido, Nombre', falling back to the full name", () => {
    expect(displayName({ firstName: "Leonardo", lastName: "Aguirre", name: "Leonardo Aguirre" })).toBe(
      "Aguirre, Leonardo",
    );
    expect(displayName({ firstName: "", lastName: "", name: "Ana" })).toBe("Ana");
  });

  it("takes the initials of nombre and apellido", () => {
    expect(initials({ firstName: "leonardo", lastName: "Aguirre", name: "" })).toBe("LA");
    expect(initials({ firstName: "", lastName: "", name: "Ana María Paz" })).toBe("AP");
    expect(initials({ firstName: "", lastName: "", name: "Ana" })).toBe("A");
  });
});
