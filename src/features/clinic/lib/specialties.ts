// Seeded into each clinic as configurable ClinicOption rows (category
// "specialty"); a tratamiento's `specialty` is one of these labels.
export const DEFAULT_SPECIALTIES = [
  "Odontología general",
  "Odontología preventiva",
  "Operatoria dental",
  "Endodoncia",
  "Periodoncia",
  "Ortodoncia",
  "Odontopediatría",
  "Prótesis",
  "Implantología",
  "Cirugía bucomaxilofacial",
  "Estética dental",
  "Diagnóstico por imágenes",
] as const;

/** The specialty each default tratamiento starts with. */
export const DEFAULT_TREATMENT_SPECIALTY: Record<string, string> = {
  "Consulta / diagnóstico": "Odontología general",
  Limpieza: "Odontología preventiva",
  "Obturación (caries)": "Operatoria dental",
  Extracción: "Cirugía bucomaxilofacial",
  Endodoncia: "Endodoncia",
  "Corona / prótesis": "Prótesis",
  Ortodoncia: "Ortodoncia",
};
