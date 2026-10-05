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
