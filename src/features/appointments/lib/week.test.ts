import { describe, expect, it } from "vitest";
import { getWeekDays, getWeekStart, isSameDay, toWeekParam } from "./week";

describe("getWeekStart", () => {
  it("returns the same Monday when given a Monday", () => {
    const monday = new Date("2026-02-02T15:30:00");
    expect(toWeekParam(getWeekStart(monday))).toBe("2026-02-02");
  });

  it("returns the prior Monday when given a mid-week day", () => {
    const thursday = new Date("2026-02-05T09:00:00");
    expect(toWeekParam(getWeekStart(thursday))).toBe("2026-02-02");
  });

  it("returns the prior Monday when given a Sunday", () => {
    const sunday = new Date("2026-02-08T09:00:00");
    expect(toWeekParam(getWeekStart(sunday))).toBe("2026-02-02");
  });
});

describe("getWeekDays", () => {
  it("returns Monday through Saturday, six days, excluding Sunday", () => {
    const monday = new Date("2026-02-02T00:00:00");
    const days = getWeekDays(monday);
    expect(days).toHaveLength(6);
    expect(toWeekParam(days[0])).toBe("2026-02-02");
    expect(toWeekParam(days[5])).toBe("2026-02-07");
  });
});

describe("isSameDay", () => {
  it("is true for two times on the same calendar day", () => {
    expect(
      isSameDay(new Date("2026-02-02T01:00:00"), new Date("2026-02-02T23:00:00")),
    ).toBe(true);
  });

  it("is false across midnight", () => {
    expect(
      isSameDay(new Date("2026-02-02T23:59:00"), new Date("2026-02-03T00:01:00")),
    ).toBe(false);
  });
});
