import { describe, expect, it } from "vitest";
import { getWeekDays, getWeekStart, isSameDay, layoutLanes, toWeekParam } from "./week";

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
  it("returns Monday through Sunday, seven days", () => {
    const monday = new Date("2026-02-02T00:00:00");
    const days = getWeekDays(monday);
    expect(days).toHaveLength(7);
    expect(toWeekParam(days[0])).toBe("2026-02-02");
    expect(toWeekParam(days[6])).toBe("2026-02-08");
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

describe("layoutLanes", () => {
  it("gives a lone turno the full width", () => {
    expect(layoutLanes([{ start: 540, end: 570 }])).toEqual([{ lane: 0, lanes: 1 }]);
  });

  it("puts overlapping turnos side by side, and back-to-back ones full width", () => {
    expect(
      layoutLanes([
        { start: 540, end: 570 }, // 9:00–9:30
        { start: 540, end: 570 }, // same slot (e.g. a "No vino" and its replacement)
        { start: 570, end: 600 }, // 9:30, right after: no overlap
      ]),
    ).toEqual([
      { lane: 0, lanes: 2 },
      { lane: 1, lanes: 2 },
      { lane: 0, lanes: 1 },
    ]);
  });

  it("sizes a whole chain of overlaps by its busiest moment", () => {
    expect(
      layoutLanes([
        { start: 540, end: 600 }, // 9–10
        { start: 570, end: 630 }, // 9:30–10:30, overlaps the first
        { start: 600, end: 660 }, // 10–11, overlaps the second, reuses lane 0
      ]),
    ).toEqual([
      { lane: 0, lanes: 2 },
      { lane: 1, lanes: 2 },
      { lane: 0, lanes: 2 },
    ]);
  });
});
