import { describe, expect, it } from "vitest";
import { isLowStock } from "./stock";

describe("isLowStock", () => {
  it("is 'out' when quantity is exactly 0", () => {
    expect(isLowStock(0, null)).toBe("out");
  });

  it("is 'out' when quantity is negative", () => {
    expect(isLowStock(-3, null)).toBe("out");
  });

  it("is 'ok' when quantity is positive and no threshold is set", () => {
    expect(isLowStock(50, null)).toBe("ok");
  });

  it("is 'low' when quantity is at the threshold", () => {
    expect(isLowStock(5, 5)).toBe("low");
  });

  it("is 'low' when quantity is below the threshold but still positive", () => {
    expect(isLowStock(3, 5)).toBe("low");
  });

  it("is 'ok' when quantity is above the threshold", () => {
    expect(isLowStock(10, 5)).toBe("ok");
  });

  it("is 'out', not 'low', when quantity is 0 even with a threshold set", () => {
    expect(isLowStock(0, 5)).toBe("out");
  });
});
