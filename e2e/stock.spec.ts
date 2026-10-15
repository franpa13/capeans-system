import { test, expect, type Page } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

/** Opens a supply row's "⋯" menu and picks an action, like PatientActions. */
async function supplyAction(page: Page, name: string, action: "Reponer" | "Editar" | "Eliminar") {
  await page.getByRole("button", { name: `Acciones para ${name}` }).click();
  await page.getByRole("menuitem", { name: action }).click();
}

async function addSupply(page: Page, name: string, fields: { price?: string; quantity?: string } = {}) {
  await page.goto("/dashboard/stock");
  await page.getByRole("button", { name: "Nuevo insumo" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo insumo" });
  await dialog.getByLabel("Nombre").fill(name);
  await dialog.getByLabel("Unidad").fill("unidad");
  if (fields.price) await dialog.getByLabel("Precio (opcional)").fill(fields.price);
  if (fields.quantity) await dialog.getByLabel("Stock inicial").fill(fields.quantity);
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByPlaceholder("Buscar...").fill(name);
  await expect(page.locator("tbody").getByText(name, { exact: true })).toBeVisible();
}

test("an insumo can be added, restocked, and shows a low-stock warning at its threshold", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const name = `Insumo E2E ${Date.now()}`;
  await addSupply(page, name, { price: "50", quantity: "100" });
  const row = page.locator("tr", { hasText: name });
  await expect(row.getByText("100 unidad", { exact: true })).toBeVisible();

  // A thousands separator is rejected, not silently parsed down
  // (Number("1.000") === 1) — same mistake already fixed for amounts.
  await supplyAction(page, name, "Reponer");
  const restock = page.getByRole("dialog", { name: "Reponer insumo" });
  await restock.getByLabel("Cantidad a reponer").fill("1.000");
  await restock.getByRole("button", { name: "Reponer" }).click();
  await expect(restock.getByText("sin puntos ni comas", { exact: false })).toBeVisible();

  await restock.getByLabel("Cantidad a reponer").fill("20");
  await restock.getByRole("button", { name: "Reponer" }).click();
  await expect(restock).toHaveCount(0);
  await expect(row.getByText("120 unidad", { exact: true })).toBeVisible();

  // 120 <= 150 → flagged low, in words and not just color.
  const edit = page.getByRole("dialog", { name: "Editar insumo" });
  await supplyAction(page, name, "Editar");
  await edit.getByLabel("Avisar cuando queden (opcional)").fill("150");
  await edit.getByRole("button", { name: "Guardar" }).click();
  await expect(edit).toHaveCount(0);
  await expect(row.getByText("Stock bajo")).toBeVisible();

  // Clearing the threshold clears the warning.
  await supplyAction(page, name, "Editar");
  await expect(edit.getByLabel("Avisar cuando queden (opcional)")).toHaveValue("150");
  await edit.getByLabel("Avisar cuando queden (opcional)").fill("");
  await edit.getByRole("button", { name: "Guardar" }).click();
  await expect(edit).toHaveCount(0);
  await expect(row.getByText("120 unidad", { exact: true })).toBeVisible();
  await expect(row.getByText("Stock bajo")).toHaveCount(0);

  // Cleanup.
  await supplyAction(page, name, "Eliminar");
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
});

test("a duplicate insumo name is rejected, and an insumo in use can't be deleted", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const name = `Insumo Dup E2E ${Date.now()}`;
  await addSupply(page, name, { quantity: "10" });

  // The modal stays open to show why.
  await page.getByRole("button", { name: "Nuevo insumo" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo insumo" });
  await dialog.getByLabel("Nombre").fill(name);
  await dialog.getByLabel("Unidad").fill("unidad");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(dialog.getByText("Ya existe un insumo con ese nombre")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toHaveCount(0);

  // Use it in a consulta (a brand-new patient, so no turnos field in the way).
  const patientName = `Paciente Insumo E2E ${Date.now()}`;
  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Agregar paciente nuevo" }).click();
  await page.fill("#newPatientName", patientName);
  await page.fill("#newPatientPhone", "11 4444-5555");
  await page.getByText("Elegí un tratamiento").click();
  await page.getByRole("option", { name: "Limpieza" }).click();
  await page.locator("#supplySelect").click();
  await page.getByRole("option", { name: new RegExp(name) }).click();
  await page.fill("#supplyQuantity", "1");
  await page.getByRole("button", { name: "Agregar insumo" }).click();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Nueva consulta" })).toHaveCount(0);

  // Deleting it is refused, and the dialog stays open to say why.
  await page.goto("/dashboard/stock");
  await page.getByPlaceholder("Buscar...").fill(name);
  await supplyAction(page, name, "Eliminar");
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(
    page.getByText("No se puede eliminar un insumo que ya fue usado en alguna consulta"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();

  // Cleanup: once the consulta is gone, the insumo can be deleted.
  await page.goto("/dashboard/consultas");
  await expect(async () => {
    await page.locator("#filter-patient").fill(patientName);
    await expect(page.locator("tbody").getByText(patientName)).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
  await page
    .locator("tbody tr", { hasText: patientName })
    .getByRole("button", { name: "Eliminar consulta" })
    .click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).last().click();
  await expect(page.locator("tbody").getByText(patientName)).toHaveCount(0);

  await page.goto("/dashboard/stock");
  await page.getByPlaceholder("Buscar...").fill(name);
  await supplyAction(page, name, "Eliminar");
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
});
