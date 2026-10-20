/** Patients have a separate nombre and apellido, plus the full name every
 * list, search and export shows (kept in sync by the data layer). */
export function fullName(firstName: string, lastName: string): string {
  return [firstName, lastName].map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean).join(" ");
}

/** For a full name typed in one field (a quick "paciente nuevo" from a
 * turno, an Excel import, patients from before the split): the last word
 * is taken as the apellido — editable afterwards on the ficha. */
export function splitFullName(name: string): { firstName: string; lastName: string } {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { firstName: words[0] ?? "", lastName: "" };
  return { firstName: words.slice(0, -1).join(" "), lastName: words[words.length - 1] };
}
