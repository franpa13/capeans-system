import { describe, expect, it } from "vitest";
import { paymentTotals } from "@/features/clinic/lib/payments";

describe("paymentTotals", () => {
  it("adds up the total and each method, listing every method even at 0", () => {
    expect(
      paymentTotals([
        { amount: 1000, method: "EFECTIVO" },
        { amount: 2500, method: "TRANSFERENCIA" },
        { amount: 500, method: "EFECTIVO" },
      ]),
    ).toEqual({
      total: 4000,
      byMethod: { EFECTIVO: 1500, TRANSFERENCIA: 2500, TARJETA: 0, OTRO: 0 },
    });
  });

  it("is all zeros with no payments", () => {
    expect(paymentTotals([]).total).toBe(0);
  });
});
