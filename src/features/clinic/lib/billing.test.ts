import { describe, expect, it } from "vitest";
import {
  outstandingBalance,
  parsePaymentStatusParam,
  paymentStatus,
  PAYMENT_STATUS_LABELS,
} from "./billing";

describe("paymentStatus", () => {
  it("is SIN_MONTO when no amount was ever charged", () => {
    expect(paymentStatus(null, 0)).toBe("SIN_MONTO");
  });

  it("is PENDIENTE when nothing has been paid yet", () => {
    expect(paymentStatus(15000, 0)).toBe("PENDIENTE");
  });

  it("is PARCIAL when something was paid but not the full amount", () => {
    expect(paymentStatus(15000, 5000)).toBe("PARCIAL");
  });

  it("is COBRADO when the full amount was paid", () => {
    expect(paymentStatus(15000, 15000)).toBe("COBRADO");
  });

  it("is COBRADO (not PENDIENTE) for a treatment explicitly priced at $0", () => {
    // A courtesy consultation the dentist deliberately charges nothing for
    // — amountPaid (0) >= amountCharged (0) is true, so there's no debt,
    // which reads as "settled", not "awaiting payment".
    expect(paymentStatus(0, 0)).toBe("COBRADO");
  });

  it("is COBRADO even if amountPaid somehow exceeds amountCharged", () => {
    expect(paymentStatus(15000, 20000)).toBe("COBRADO");
  });
});

describe("outstandingBalance", () => {
  it("sums (charged - paid) across consultations with an amount", () => {
    const balance = outstandingBalance([
      { amountCharged: 15000, amountPaid: 5000 },
      { amountCharged: 10000, amountPaid: 10000 },
    ]);
    expect(balance).toBe(10000);
  });

  it("ignores consultations with no amount charged", () => {
    const balance = outstandingBalance([
      { amountCharged: null, amountPaid: 0 },
      { amountCharged: 5000, amountPaid: 0 },
    ]);
    expect(balance).toBe(5000);
  });

  it("never lets one overpaid consultation make the total negative", () => {
    const balance = outstandingBalance([
      { amountCharged: 10000, amountPaid: 15000 },
      { amountCharged: 5000, amountPaid: 0 },
    ]);
    expect(balance).toBe(5000);
  });

  it("is 0 for an empty list", () => {
    expect(outstandingBalance([])).toBe(0);
  });
});

describe("PAYMENT_STATUS_LABELS", () => {
  it("has a label for every status", () => {
    expect(PAYMENT_STATUS_LABELS.SIN_MONTO).toBeTruthy();
    expect(PAYMENT_STATUS_LABELS.PENDIENTE).toBeTruthy();
    expect(PAYMENT_STATUS_LABELS.PARCIAL).toBeTruthy();
    expect(PAYMENT_STATUS_LABELS.COBRADO).toBeTruthy();
  });
});

describe("parsePaymentStatusParam", () => {
  it("returns undefined for undefined", () => {
    expect(parsePaymentStatusParam(undefined)).toBeUndefined();
  });

  it("parses a single valid status", () => {
    expect(parsePaymentStatusParam("PENDIENTE")).toEqual(["PENDIENTE"]);
  });

  it("parses several comma-separated valid statuses", () => {
    expect(parsePaymentStatusParam("PENDIENTE,PARCIAL")).toEqual(["PENDIENTE", "PARCIAL"]);
  });

  it("drops an unrecognized value instead of passing it through", () => {
    expect(parsePaymentStatusParam("PENDIENTE,FOO")).toEqual(["PENDIENTE"]);
  });

  it("returns undefined when nothing in the param is a recognized status", () => {
    expect(parsePaymentStatusParam("FOO")).toBeUndefined();
  });
});
