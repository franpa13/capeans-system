type Named = { firstName: string; lastName: string; name: string };

/** Whole years old on `today`, or null without a birth date. The birth
 * date is a date-only value stored as UTC midnight, so it's read in UTC
 * (locally it would be the day before in Argentina). */
export function ageOn(birthDate: Date | null, today: Date = new Date()): number | null {
  if (!birthDate) return null;
  const month = birthDate.getUTCMonth();
  const day = birthDate.getUTCDate();
  let age = today.getFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    today.getMonth() < month || (today.getMonth() === month && today.getDate() < day);
  if (beforeBirthday) age--;
  return age;
}

/** "Aguirre, Leonardo" — how the ficha titles a patient. */
export function displayName(patient: Named): string {
  const first = patient.firstName.trim();
  const last = patient.lastName.trim();
  if (first && last) return `${last}, ${first}`;
  return patient.name;
}

/** "LA" for Leonardo Aguirre: the avatar on the ficha. */
export function initials(patient: Named): string {
  const words = [patient.firstName, patient.lastName].every((w) => w.trim())
    ? [patient.firstName, patient.lastName]
    : patient.name.trim().split(/\s+/);
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return picked
    .map((w) => w.trim().charAt(0).toUpperCase())
    .join("");
}
