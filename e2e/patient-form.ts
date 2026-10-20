import { expect, type Page } from "@playwright/test";

/** Creates a patient through the "Nuevo paciente" page: the full name is
 * split into nombre (all but the last word) and apellido (the last word),
 * so the saved full name is exactly `name`. `fill` adds more fields before
 * saving. Ends on the new patient's ficha. */
export async function createPatient(
  page: Page,
  name: string,
  phone: string,
  fill?: () => Promise<void>,
) {
  const words = name.trim().split(/\s+/);
  await page.goto("/dashboard/pacientes/nuevo");
  await page.fill("#firstName", words.slice(0, -1).join(" ") || words[0]);
  await page.fill("#lastName", words.length > 1 ? words[words.length - 1] : "-");
  await page.fill("#phone", phone);
  if (fill) await fill();
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page).toHaveURL(/\/dashboard\/pacientes\/(?!nuevo)[^/?]+$/);
}
