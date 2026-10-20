/** A color per obra social, so turnos can be told apart at a glance on the
 * agenda without anything to set by hand: it's derived from the name
 * already on the patient's ficha, and stays the same everywhere. */
export const INSURANCE_COLORS = [
  "violet",
  "rose",
  "amber",
  "emerald",
  "sky",
  "orange",
  "fuchsia",
  "teal",
] as const;
export type InsuranceColor = (typeof INSURANCE_COLORS)[number] | "neutral";

export function insuranceColor(insurance: string | null | undefined): InsuranceColor {
  const name = insurance?.trim().toLowerCase() ?? "";
  if (!name || name.startsWith("particular") || name.includes("sin obra social")) return "neutral";
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return INSURANCE_COLORS[hash % INSURANCE_COLORS.length];
}

/** Tailwind classes per color, spelled out so the build keeps them. */
export const INSURANCE_DOT: Record<InsuranceColor, string> = {
  violet: "bg-violet-500",
  rose: "bg-rose-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  orange: "bg-orange-500",
  fuchsia: "bg-fuchsia-500",
  teal: "bg-teal-500",
  neutral: "bg-muted-foreground/50",
};

export const INSURANCE_EDGE: Record<InsuranceColor, string> = {
  violet: "border-l-violet-500",
  rose: "border-l-rose-500",
  amber: "border-l-amber-500",
  emerald: "border-l-emerald-500",
  sky: "border-l-sky-500",
  orange: "border-l-orange-500",
  fuchsia: "border-l-fuchsia-500",
  teal: "border-l-teal-500",
  neutral: "border-l-muted-foreground/40",
};
