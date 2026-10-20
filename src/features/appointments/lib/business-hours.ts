/** The subset of a BusinessHours row this module needs — kept structural
 * (not imported from @prisma/client) so these pure functions stay testable
 * with plain objects, no DB/Prisma dependency. */
export type BusinessHoursLike = {
  weekday: number;
  isOpen: boolean;
  openTime1: string | null;
  closeTime1: string | null;
  openTime2: string | null;
  closeTime2: string | null;
};

export type ClosedRange = { startMinutes: number; endMinutes: number };

const MINUTES_PER_DAY = 24 * 60;

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** The minute-of-day ranges OUTSIDE business hours for one day — used to
 * shade the calendar grid. Spans the full day when the day is closed or
 * has no hours configured at all (an unconfigured day is never treated as
 * "open all day": with no open/close time there's nothing to shade around). */
export function closedRanges(hours: BusinessHoursLike | undefined): ClosedRange[] {
  if (!hours || !hours.isOpen || !hours.openTime1 || !hours.closeTime1) {
    return [{ startMinutes: 0, endMinutes: MINUTES_PER_DAY }];
  }

  const open1 = toMinutes(hours.openTime1);
  const close1 = toMinutes(hours.closeTime1);
  const ranges: ClosedRange[] = [{ startMinutes: 0, endMinutes: open1 }];

  if (hours.openTime2 && hours.closeTime2) {
    const open2 = toMinutes(hours.openTime2);
    const close2 = toMinutes(hours.closeTime2);
    ranges.push({ startMinutes: close1, endMinutes: open2 });
    ranges.push({ startMinutes: close2, endMinutes: MINUTES_PER_DAY });
  } else {
    ranges.push({ startMinutes: close1, endMinutes: MINUTES_PER_DAY });
  }

  return ranges.filter((r) => r.endMinutes > r.startMinutes);
}

export function businessHoursForWeekday<T extends BusinessHoursLike>(
  hours: T[],
  weekday: number,
): T | undefined {
  return hours.find((h) => h.weekday === weekday);
}

export type BoundaryLine = { minutes: number; label: "Hora inicio" | "Hora fin" };
export type BoundarySegment = BoundaryLine & { startDay: number; dayCount: number };

/** The week grid's open/close lines as continuous segments: consecutive
 * days that share a line (same minute and kind) get ONE line across all
 * of them, instead of one per day column that reads as a dashed line
 * broken at every column. `perDay` is each visible day's lines, in order. */
export function boundarySegments(perDay: BoundaryLine[][]): BoundarySegment[] {
  const segments: BoundarySegment[] = [];
  const open = new Map<string, BoundarySegment>();
  perDay.forEach((lines, day) => {
    const today = new Set<string>();
    for (const line of lines) {
      const key = `${line.minutes}|${line.label}`;
      today.add(key);
      const running = open.get(key);
      if (running && running.startDay + running.dayCount === day) {
        running.dayCount++;
      } else {
        const segment = { ...line, startDay: day, dayCount: 1 };
        segments.push(segment);
        open.set(key, segment);
      }
    }
    for (const key of [...open.keys()]) if (!today.has(key)) open.delete(key);
  });
  return segments;
}
