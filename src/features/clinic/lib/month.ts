/** "YYYY-MM" month params for the Ingresos page, in local time. */

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toMonthParam(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** The first day of the month a "YYYY-MM" param names — the current month
 * for a missing or malformed one. */
export function parseMonthParam(value: string | undefined, now = new Date()): Date {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return new Date(Number(match[1]), month - 1, 1);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function addMonths(monthStart: Date, months: number): Date {
  return new Date(monthStart.getFullYear(), monthStart.getMonth() + months, 1);
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function formatMonth(monthStart: Date): string {
  return `${MONTHS[monthStart.getMonth()]} ${monthStart.getFullYear()}`;
}
