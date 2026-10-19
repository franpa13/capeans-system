import { describe, expect, it } from "vitest";
import { addMonths, formatMonth, parseMonthParam, toMonthParam } from "@/features/clinic/lib/month";

describe("month params", () => {
  const now = new Date(2026, 9, 19);

  it("parses a valid YYYY-MM to that month's first day", () => {
    expect(parseMonthParam("2026-02", now)).toEqual(new Date(2026, 1, 1));
  });

  it("falls back to the current month for a missing or malformed param", () => {
    expect(parseMonthParam(undefined, now)).toEqual(new Date(2026, 9, 1));
    expect(parseMonthParam("2026-13", now)).toEqual(new Date(2026, 9, 1));
    expect(parseMonthParam("hola", now)).toEqual(new Date(2026, 9, 1));
  });

  it("moves across years and formats in Spanish", () => {
    expect(toMonthParam(addMonths(new Date(2026, 11, 1), 1))).toBe("2027-01");
    expect(formatMonth(new Date(2026, 9, 1))).toBe("Octubre 2026");
  });
});
