export const OTHER_TREATMENT = "Otro";

// Seeded into each clinic's configurable ClinicOption rows on creation —
// not used directly for rendering after that (see clinic-options.ts).
// OTHER_TREATMENT is deliberately excluded: it's a sentinel the UI always
// appends itself, not a configurable option a clinic can rename/delete.
export const DEFAULT_TREATMENT_OPTIONS = [
  "Consulta / diagnóstico",
  "Limpieza",
  "Obturación (caries)",
  "Extracción",
  "Endodoncia",
  "Corona / prótesis",
  "Ortodoncia",
] as const;
