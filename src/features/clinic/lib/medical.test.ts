import { describe, expect, it } from "vitest";
import { medicalAlerts, sanitizeConditions } from "@/features/clinic/lib/medical";

describe("medicalAlerts", () => {
  it("lists the allergy first, then each marked condition by its label", () => {
    expect(
      medicalAlerts({ allergies: "penicilina", medicalConditions: ["diabetes", "anticoagulantes"] }),
    ).toEqual(["Alergia: penicilina", "Toma anticoagulantes", "Diabetes"]);
  });

  it("is empty for a patient with nothing to warn about", () => {
    expect(medicalAlerts({ allergies: "  ", medicalConditions: [] })).toEqual([]);
    expect(medicalAlerts({ allergies: null, medicalConditions: [] })).toEqual([]);
  });

  it("ignores a condition it doesn't know", () => {
    expect(medicalAlerts({ allergies: null, medicalConditions: ["inventada"] })).toEqual([]);
  });
});

describe("sanitizeConditions", () => {
  it("keeps only known conditions, once each, in the list's own order", () => {
    expect(sanitizeConditions(["embarazo", "x", "diabetes", "embarazo"])).toEqual([
      "diabetes",
      "embarazo",
    ]);
  });
});
