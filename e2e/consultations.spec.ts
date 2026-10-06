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

test("clicking a consultation row opens it for editing, and changes persist", async ({
  page,
}) => {
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

  await page.locator("tbody tr", { hasText: patientName }).click();
  await page.getByText("Editar consulta").waitFor();
  await page.locator("#edit-notes").fill("Nota editada");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Editar consulta")).toHaveCount(0);
  await expect(page.locator("tbody").getByText("Nota editada")).toBeVisible();
});

test("deleting a consultation from the edit dialog removes it after confirming", async ({
  page,
}) => {
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

  await page.locator("tbody tr", { hasText: patientName }).click();
  await page.getByRole("button", { name: "Eliminar" }).click();
  await page.getByText("¿Eliminar esta consulta?").waitFor();
  await page.getByRole("button", { name: "Eliminar", exact: true }).last().click();

  await expect(page.locator("tbody").getByText(patientName)).toHaveCount(0);
});
