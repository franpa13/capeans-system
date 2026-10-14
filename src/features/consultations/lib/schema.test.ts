import { describe, expect, it } from "vitest";
import { consultationSchema, editConsultationSchema } from "./schema";

function baseNewValues(overrides: Partial<Record<string, string>> = {}) {
  return {
    patientId: "patient-1",
    newPatientEmail: "",
    date: "2026-01-01",
    time: "10:00",
    treatment: "Limpieza",
    ...overrides,
  };
}

function baseEditValues(overrides: Partial<Record<string, string>> = {}) {
  return {
    date: "2026-01-01",
    time: "10:00",
    treatment: "Limpieza",
    ...overrides,
  };
}

describe("consultationSchema amount validation", () => {
  it("rejects a negative amountCharged", () => {
    const result = consultationSchema.safeParse(baseNewValues({ amountCharged: "-500" }));
    expect(result.success).toBe(false);
  });

  it("rejects an amountCharged typed with a thousands separator", () => {
    // "8.000" parses via Number() to 8, not 8000 — a user re-typing a
    // formatted amount like "$ 8.000" must not silently save 8.
    const result = consultationSchema.safeParse(baseNewValues({ amountCharged: "8.000" }));
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer amountCharged", () => {
    const result = consultationSchema.safeParse(baseNewValues({ amountCharged: "1.5" }));
    expect(result.success).toBe(false);
  });

  it("accepts a valid whole-number amountCharged", () => {
    const result = consultationSchema.safeParse(baseNewValues({ amountCharged: "8000" }));
    expect(result.success).toBe(true);
  });

  it("rejects Parcial pagado greater than monto a cobrar", () => {
    const result = consultationSchema.safeParse(
      baseNewValues({ amountCharged: "10000", paymentChoice: "PARCIAL", partialAmountPaid: "99999" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a partialAmountPaid typed with a thousands separator", () => {
    const result = consultationSchema.safeParse(
      baseNewValues({ amountCharged: "10000", paymentChoice: "PARCIAL", partialAmountPaid: "3.000" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects choosing Cobrado with no amountCharged", () => {
    const result = consultationSchema.safeParse(baseNewValues({ paymentChoice: "COBRADO" }));
    expect(result.success).toBe(false);
  });

  it("rejects choosing Parcial with no amountCharged", () => {
    const result = consultationSchema.safeParse(
      baseNewValues({ paymentChoice: "PARCIAL", partialAmountPaid: "1000" }),
    );
    expect(result.success).toBe(false);
  });

  it("allows Pendiente with no amountCharged", () => {
    const result = consultationSchema.safeParse(baseNewValues({ paymentChoice: "PENDIENTE" }));
    expect(result.success).toBe(true);
  });
});

describe("editConsultationSchema amount validation", () => {
  it("rejects an amountCharged typed with a thousands separator", () => {
    const result = editConsultationSchema.safeParse(baseEditValues({ amountCharged: "8.000" }));
    expect(result.success).toBe(false);
  });

  it("accepts a valid whole-number amountCharged", () => {
    const result = editConsultationSchema.safeParse(baseEditValues({ amountCharged: "8000" }));
    expect(result.success).toBe(true);
  });
});
