/** Medical conditions a dentist checks before anesthesia or an
 * extraction. Stored on the patient as these `value` keys; the order here
 * is the order they're shown and warned about (most dangerous first). */
export const MEDICAL_CONDITIONS = [
  { value: "anticoagulantes", label: "Toma anticoagulantes" },
  { value: "cardiaco", label: "Problemas cardíacos" },
  { value: "hipertension", label: "Hipertensión" },
  { value: "diabetes", label: "Diabetes" },
  { value: "embarazo", label: "Embarazo" },
  { value: "asma", label: "Asma" },
  { value: "epilepsia", label: "Epilepsia" },
] as const;

const LABELS = new Map<string, string>(MEDICAL_CONDITIONS.map((c) => [c.value, c.label]));

/** Known conditions only, once each, in MEDICAL_CONDITIONS order — what
 * gets saved, whatever the form (or an import) sent. */
export function sanitizeConditions(values: string[]): string[] {
  const picked = new Set(values);
  return MEDICAL_CONDITIONS.map((c) => c.value).filter((v) => picked.has(v));
}

/** The warnings to show wherever this patient is about to be treated:
 * the allergy first, then each marked condition. */
export function medicalAlerts(patient: {
  allergies: string | null;
  medicalConditions: string[];
}): string[] {
  const alerts: string[] = [];
  const allergy = patient.allergies?.trim();
  if (allergy) alerts.push(`Alergia: ${allergy}`);
  for (const value of sanitizeConditions(patient.medicalConditions)) {
    alerts.push(LABELS.get(value)!);
  }
  return alerts;
}
