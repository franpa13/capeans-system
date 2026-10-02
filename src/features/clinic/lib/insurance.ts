// Seeded into each clinic's configurable ClinicOption rows on creation —
// not used directly for rendering after that (see clinic-options.ts).
export const DEFAULT_INSURANCE_OPTIONS = [
  "OSDE",
  "Swiss Medical",
  "Galeno",
  "Medicus",
  "OMINT",
  "PAMI",
  "IOMA",
  "Sancor Salud",
  "Unión Personal",
  "Prevención Salud",
] as const;

export const NO_INSURANCE = "Particular (sin obra social)";
export const OTHER_INSURANCE = "Otra";
