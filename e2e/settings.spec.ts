import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

test("an insurance option can be added, renamed, and deleted from Configuración", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({
    page,
    emailAddress: process.env.E2E_TEST_EMAIL!,
  });

  const label = `Obra Social E2E ${Date.now()}`;
  const renamed = `${label} (renombrada)`;

  await page.goto("/dashboard/configuracion");
  await page
    .getByPlaceholder("Agregar nuevo...")
    .first()
    .fill(label);
  await page.getByRole("button", { name: "Agregar" }).first().click();
  await expect(page.getByText(label, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: `Editar ${label}` }).click();
  await page.getByRole("textbox", { name: "Editar valor" }).fill(renamed);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(renamed, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: `Eliminar ${renamed}` }).click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.getByText(renamed, { exact: true })).not.toBeVisible();

  // The new option is immediately selectable on the Pacientes form.
  const anotherLabel = `Obra Social E2E ${Date.now()}`;
  await page.getByPlaceholder("Agregar nuevo...").first().fill(anotherLabel);
  await page.getByRole("button", { name: "Agregar" }).first().click();
  await expect(page.getByText(anotherLabel, { exact: true })).toBeVisible();

  await page.goto("/dashboard/pacientes");
  await page.getByRole("button", { name: "Nuevo paciente" }).click();
  await page.getByLabel("Obra social").click();
  await expect(page.getByRole("option", { name: anotherLabel })).toBeVisible();
});
