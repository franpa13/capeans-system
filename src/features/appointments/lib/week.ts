const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Full Spanish weekday names, indexed by JS Date.getDay() (0=Sunday). */
export const WEEKDAY_FULL_LABELS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Monday 00:00 (local) of the week containing `date`. */
export function getWeekStart(date: Date): Date {
  const day = startOfDay(date);
  const dayOfWeek = day.getDay(); // 0 = Sunday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  day.setDate(day.getDate() + diffToMonday);
  return day;
}

/** Monday..Sunday (7 days) for the week starting at `weekStart`. */
export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatDayLabel(date: Date): string {
  return `${DAY_LABELS[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;
}

export function toWeekParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseWeekParam(value?: string): Date {
  if (!value) return new Date();
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/** Side-by-side columns for turnos that overlap in time (e.g. a "No vino"
 * that stays on the agenda and the turno given in its freed slot): each
 * item gets a lane, and `lanes` is how many columns its group of
 * overlapping items needs. Items are minutes from midnight, in the order
 * to draw them; results come back in the same order. */
export function layoutLanes(items: { start: number; end: number }[]): { lane: number; lanes: number }[] {
  const order = items.map((_, i) => i).sort((a, b) => items[a].start - items[b].start || items[a].end - items[b].end);
  const result: { lane: number; lanes: number }[] = items.map(() => ({ lane: 0, lanes: 1 }));
  let group: number[] = [];
  let groupEnd = -Infinity;
  let laneEnds: number[] = [];

  const closeGroup = () => {
    for (const i of group) result[i].lanes = laneEnds.length;
    group = [];
    laneEnds = [];
  };

  for (const i of order) {
    const { start, end } = items[i];
    if (start >= groupEnd) {
      closeGroup();
      groupEnd = -Infinity;
    }
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    result[i].lane = lane;
    group.push(i);
    groupEnd = Math.max(groupEnd, end);
  }
  closeGroup();
  return result;
}
