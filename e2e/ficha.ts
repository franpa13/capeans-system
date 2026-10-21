import type { Page } from "@playwright/test";

/** A patient's ficha is titled "Apellido, Nombre" — for a full name given
 * in one piece, its last word is the apellido. */
export function fichaHeading(page: Page, fullName: string) {
  const words = fullName.trim().split(/\s+/);
  const last = words.pop();
  return page.getByRole("heading", { level: 1, name: `${last}, ${words.join(" ")}` });
}

/** Opens one of the ficha's sections (Resumen, Ficha médica, Consultas…). */
export async function openFichaSection(page: Page, label: string) {
  await page
    .getByRole("tablist", { name: "Secciones del paciente" })
    .getByRole("tab", { name: label })
    .click();
}
