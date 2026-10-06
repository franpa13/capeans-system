import { describe, expect, it } from "vitest";
import {
  combineDateAndTime,
  formatTime,
  splitDateAndTime,
  toLocalDateString,
} from "./format";

describe("toLocalDateString", () => {
  it("reads the date's own local day, not the UTC day", () => {
    // new Date(y, m, d, h, mi) always constructs in local time, regardless
    // of the environment's timezone — a late-evening local time is exactly
    // the case toISOString().slice(0, 10) gets wrong (it reads the UTC
    // day, which can already be tomorrow).
    const lateEvening = new Date(2026, 9, 6, 23, 30);
    expect(toLocalDateString(lateEvening)).toBe("2026-10-06");
  });

  it("pads single-digit months and days", () => {
    const date = new Date(2026, 0, 5, 9, 0);
    expect(toLocalDateString(date)).toBe("2026-01-05");
  });
});

describe("combineDateAndTime / splitDateAndTime", () => {
  it("round-trips a late-evening date and time without shifting the day", () => {
    const date = "2026-10-06";
    const time = "23:30";
    expect(splitDateAndTime(combineDateAndTime(date, time))).toEqual({ date, time });
  });

  it("round-trips midnight correctly", () => {
    const date = "2026-01-01";
    const time = "00:00";
    expect(splitDateAndTime(combineDateAndTime(date, time))).toEqual({ date, time });
  });
});

describe("formatTime", () => {
  it("formats a time as HH:mm", () => {
    const date = new Date(2026, 9, 6, 14, 5);
    expect(formatTime(date)).toMatch(/14:05/);
  });
});
