/** Choices for the patient form's selects. Stored as the `value`. */

export const GENDERS = [
  { value: "femenino", label: "Femenino" },
  { value: "masculino", label: "Masculino" },
  { value: "otro", label: "Otro" },
  { value: "prefiero_no_decir", label: "Prefiere no decir" },
] as const;

export const IVA_CONDITIONS = [
  { value: "consumidor_final", label: "Consumidor final" },
  { value: "monotributo", label: "Monotributista" },
  { value: "responsable_inscripto", label: "Responsable inscripto" },
  { value: "exento", label: "Exento" },
] as const;

export const BLOOD_TYPES = ["0+", "0-", "A+", "A-", "B+", "B-", "AB+", "AB-"] as const;

export const REFERRAL_SOURCES = [
  { value: "recomendacion", label: "Recomendación de otro paciente" },
  { value: "redes", label: "Redes sociales" },
  { value: "internet", label: "Google / internet" },
  { value: "obra_social", label: "Cartilla de la obra social" },
  { value: "paso", label: "Pasó por el consultorio" },
  { value: "otro", label: "Otro" },
] as const;

export function optionLabel(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  return options.find((o) => o.value === value)?.label ?? value;
}
