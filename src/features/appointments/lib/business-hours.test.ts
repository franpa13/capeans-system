import { describe, expect, it } from "vitest";
import { businessHoursForWeekday, closedRanges } from "./business-hours";

type Row = {
  weekday: number;
  isOpen: boolean;
  openTime1: string | null;
  closeTime1: string | null;
  openTime2: string | null;
  closeTime2: string | null;
};

function row(overrides: Partial<Row> = {}): Row {
  return {
    weekday: 1,
    isOpen: true,
    openTime1: "09:00",
    closeTime1: "18:00",
    openTime2: null,
    closeTime2: null,
    ...overrides,
  };
}

describe("closedRanges", () => {
  it("returns before-open and after-close ranges for a simple single-shift day", () => {
    expect(closedRanges(row())).toEqual([
      { startMinutes: 0, endMinutes: 9 * 60 },
      { startMinutes: 18 * 60, endMinutes: 24 * 60 },
    ]);
  });

  it("adds a closed range for the lunch break when a second shift is configured", () => {
    expect(
      closedRanges(row({ closeTime1: "13:00", openTime2: "15:00", closeTime2: "19:00" })),
    ).toEqual([
      { startMinutes: 0, endMinutes: 9 * 60 },
      { startMinutes: 13 * 60, endMinutes: 15 * 60 },
      { startMinutes: 19 * 60, endMinutes: 24 * 60 },
    ]);
  });

  it("omits an empty before-open range when the day opens at midnight", () => {
    expect(closedRanges(row({ openTime1: "00:00" }))).toEqual([
      { startMinutes: 18 * 60, endMinutes: 24 * 60 },
    ]);
  });

  it("spans the full day when isOpen is false", () => {
    expect(closedRanges(row({ isOpen: false }))).toEqual([
      { startMinutes: 0, endMinutes: 24 * 60 },
    ]);
  });

  it("spans the full day when no hours are configured for it", () => {
    expect(closedRanges(undefined)).toEqual([{ startMinutes: 0, endMinutes: 24 * 60 }]);
  });
});

describe("businessHoursForWeekday", () => {
  it("finds the row matching the given weekday", () => {
    const hours = [row({ weekday: 1 }), row({ weekday: 2, openTime1: "10:00" })];
    expect(businessHoursForWeekday(hours, 2)?.openTime1).toBe("10:00");
  });

  it("returns undefined when no row matches", () => {
    const hours = [row({ weekday: 1 })];
    expect(businessHoursForWeekday(hours, 6)).toBeUndefined();
  });
});
