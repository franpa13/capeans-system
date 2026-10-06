import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

test("a created consultation survives a full page reload", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({
    page,
    emailAddress: process.env.E2E_TEST_EMAIL!,
  });

  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Agregar paciente nuevo" }).click();
  const patientName = `Paciente Consulta E2E ${Date.now()}`;
  await page.fill("#newPatientName", patientName);
  await page.fill("#newPatientPhone", "11 1111-1111");
  // Combobox order in the dialog once "Agregar paciente nuevo" is selected:
  // 0 = Paciente, 1 = Obra social (inline new-patient fields),
  // 2 = Piezas dentales, 3 = Tratamiento realizado.
  await page.getByRole("combobox").nth(3).click();
  await page.getByRole("option", { name: "Limpieza" }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator("tbody").getByText(patientName)).toBeVisible();

  await page.reload();
  await expect(page.locator("tbody").getByText(patientName)).toBeVisible();
});

test("the Editar action opens the row for editing, and changes persist", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Agregar paciente nuevo" }).click();
  const patientName = `Paciente Editar E2E ${Date.now()}`;
  await page.fill("#newPatientName", patientName);
  await page.fill("#newPatientPhone", "11 2222-2222");
  await page.getByRole("combobox").nth(3).click();
  await page.getByRole("option", { name: "Limpieza" }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator("tbody").getByText(patientName)).toBeVisible();

  const row = page.locator("tbody tr", { hasText: patientName });
  await row.getByRole("button", { name: "Editar consulta" }).click();
  await page.getByText("Editar consulta").waitFor();
  await page.locator("#edit-notes").fill("Nota editada");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Editar consulta")).toHaveCount(0);
  await expect(row.getByText("Nota editada")).toBeVisible();
});

test("the Ver action opens a read-only detail view with the full observations", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Agregar paciente nuevo" }).click();
  const patientName = `Paciente Ver E2E ${Date.now()}`;
  await page.fill("#newPatientName", patientName);
  await page.fill("#newPatientPhone", "11 4444-4444");
  await page.getByRole("combobox").nth(3).click();
  await page.getByRole("option", { name: "Limpieza" }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator("tbody").getByText(patientName)).toBeVisible();

  const row = page.locator("tbody tr", { hasText: patientName });
  await row.getByRole("button", { name: "Ver consulta" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Detalle de la consulta")).toBeVisible();
  await expect(dialog.getByText(patientName)).toBeVisible();

  // It's read-only — no inputs to type into, just a way back to editing.
  await expect(dialog.getByRole("button", { name: "Editar", exact: true })).toBeVisible();
  await expect(page.locator("#edit-notes")).toHaveCount(0);
});

test("deleting a consultation from the table removes it after confirming", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Agregar paciente nuevo" }).click();
  const patientName = `Paciente Borrar E2E ${Date.now()}`;
  await page.fill("#newPatientName", patientName);
  await page.fill("#newPatientPhone", "11 3333-3333");
  await page.getByRole("combobox").nth(3).click();
  await page.getByRole("option", { name: "Limpieza" }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator("tbody").getByText(patientName)).toBeVisible();

  const row = page.locator("tbody tr", { hasText: patientName });
  await row.getByRole("button", { name: "Eliminar consulta" }).click();
  await page.getByText("¿Eliminar esta consulta?").waitFor();
  await page.getByRole("button", { name: "Eliminar", exact: true }).last().click();

  await expect(page.locator("tbody").getByText(patientName)).toHaveCount(0);
});

test("a consultation records the time it was logged, not just the date", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Agregar paciente nuevo" }).click();
  const patientName = `Paciente Hora E2E ${Date.now()}`;
  await page.fill("#newPatientName", patientName);
  await page.fill("#newPatientPhone", "11 5555-5555");
  await page.fill("#time", "15:45");
  await page.getByRole("combobox").nth(3).click();
  await page.getByRole("option", { name: "Limpieza" }).click();
  await page.getByRole("button", { name: "Guardar" }).click();

  const row = page.locator("tbody tr", { hasText: patientName });
  await expect(row.getByText("15:45")).toBeVisible();
});
