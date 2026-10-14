import { expect, type Page } from "@playwright/test";

type Kind = "obra social" | "tratamiento";

const NEW_TITLE: Record<Kind, string> = {
  "obra social": "Nueva obra social",
  tratamiento: "Nuevo tratamiento",
};

/** Adds an obra social / tratamiento through Configuración's "Nuevo…"
 * modal (the matching tab must already be open), then searches the list
 * for it — the list is paginated, so a new item may not land on page 1. */
export async function addClinicOption(page: Page, kind: Kind, label: string, price?: string) {
  await page.getByRole("button", { name: NEW_TITLE[kind] }).click();
  const dialog = page.getByRole("dialog", { name: NEW_TITLE[kind] });
  await dialog.getByLabel("Nombre").fill(label);
  if (price) await dialog.getByLabel("Precio (opcional)").fill(price);
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByPlaceholder("Buscar...").fill(label);
  await expect(page.getByText(label, { exact: true })).toBeVisible();
}

/** Opens Editar for `label`, applies the given changes, and saves. */
export async function editClinicOption(
  page: Page,
  kind: Kind,
  label: string,
  changes: { label?: string; price?: string },
) {
  await page.getByRole("button", { name: `Editar ${label}` }).click();
  const dialog = page.getByRole("dialog", { name: `Editar ${kind}` });
  if (changes.label !== undefined) await dialog.getByLabel("Nombre").fill(changes.label);
  if (changes.price !== undefined) await dialog.getByLabel("Precio (opcional)").fill(changes.price);
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(dialog).toHaveCount(0);
}
