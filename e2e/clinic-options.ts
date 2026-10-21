import { expect, type Page } from "@playwright/test";

type Kind = "obra social" | "tratamiento";

const NEW_TITLE: Record<Kind, string> = {
  "obra social": "Nueva obra social",
  tratamiento: "Nuevo tratamiento",
};

// Tratamientos live in their own catalog, whose form and search differ.
const PRICE_LABEL: Record<Kind, string> = {
  "obra social": "Precio (opcional)",
  tratamiento: "Precio de lista",
};
const SEARCH: Record<Kind, string> = {
  "obra social": "Buscar...",
  tratamiento: "Buscar por nombre o código...",
};

/** Filters the obra social / tratamiento list down to `label`. */
export async function searchClinicOption(page: Page, kind: Kind, label: string) {
  await page.getByPlaceholder(SEARCH[kind]).fill(label);
}

/** Adds an obra social / tratamiento through Configuración's "Nuevo…"
 * modal (the matching tab must already be open), then searches the list
 * for it — the list is paginated, so a new item may not land on page 1. */
export async function addClinicOption(page: Page, kind: Kind, label: string, price?: string) {
  await page.getByRole("button", { name: NEW_TITLE[kind] }).click();
  const dialog = page.getByRole("dialog", { name: NEW_TITLE[kind] });
  await dialog.getByLabel("Nombre").fill(label);
  if (price) await dialog.getByLabel(PRICE_LABEL[kind]).fill(price);
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(dialog).toHaveCount(0);
  await searchClinicOption(page, kind, label);
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
  if (changes.price !== undefined) await dialog.getByLabel(PRICE_LABEL[kind]).fill(changes.price);
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(dialog).toHaveCount(0);
}
