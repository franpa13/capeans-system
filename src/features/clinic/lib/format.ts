export function formatDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** A Date's own calendar date as "YYYY-MM-DD", in local time — unlike
 * toISOString().slice(0, 10), which reads the UTC date and silently shifts
 * to the wrong day for any local time that crosses the UTC day boundary
 * (e.g. anything after 21:00 in Argentina, UTC-3). Consultations now carry
 * a real time of day, so that boundary is routinely crossed; this is the
 * one safe way to turn a stored Date back into a date-only input value. */
export function toLocalDateString(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/** Combines a "YYYY-MM-DD" date input and an "HH:mm" time input (as local
 * time, not UTC) into one Date for storage. */
export function combineDateAndTime(dateValue: string, timeValue: string): Date {
  return new Date(`${dateValue}T${timeValue}`);
}

/** The inverse of combineDateAndTime: splits a stored Date back into the
 * "YYYY-MM-DD" / "HH:mm" strings the date and time inputs expect. */
export function splitDateAndTime(value: Date): { date: string; time: string } {
  return {
    date: toLocalDateString(value),
    time: value.toTimeString().slice(0, 5),
  };
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Whole pesos only (no centavos — see the Global Constraints in the
 * Precios y Cobros plan) in Argentine thousands-separator notation. */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}
