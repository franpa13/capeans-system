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

test("business hours can be closed for a day and persist after reload", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard/configuracion");
  await page.getByRole("tab", { name: "Horario de atención" }).click();

  // The save button is only disabled while its request is in flight (see
  // BusinessHoursManager's savingDay state) - wait for it to re-enable
  // before the next action. Two saves fired close together race: whichever
  // request's response lands last wins, regardless of click order, so a
  // "reset to a known state" save immediately followed by the test's own
  // save can silently undo it.
  const saveButton = page.getByRole("button", { name: "Guardar horario Martes" });
  async function saveAndWait() {
    await saveButton.click();
    await expect(saveButton).toBeEnabled();
  }

  // Tuesday (weekday 2) starts open with default hours seeded — but don't
  // assume that's still true (a previous run's cleanup step may not have
  // run if it failed partway through); force a known starting state.
  if (!(await page.locator("#open-2").isChecked())) {
    await page.locator("#open-2").click();
    await page.getByLabel("Entrada Martes").fill("09:00");
    await page.getByLabel("Salida Martes").fill("18:00");
  }
  await saveAndWait();

  // Now close it.
  await page.locator("#open-2").click();
  await expect(page.getByLabel("Entrada Martes")).toHaveCount(0);
  await saveAndWait();

  await page.reload();
  await page.getByRole("tab", { name: "Horario de atención" }).click();
  await expect(page.locator("#open-2")).not.toBeChecked();
  await expect(page.getByLabel("Entrada Martes")).toHaveCount(0);

  // Reopen it with a lunch-break split, and confirm that persists too.
  await page.locator("#open-2").click();
  await page.getByLabel("Entrada Martes").fill("08:00");
  await page.getByLabel("Salida Martes").fill("12:00");
  await page.getByRole("button", { name: "Agregar segundo turno Martes" }).click();
  await page.getByLabel("Entrada turno tarde Martes").fill("14:00");
  await page.getByLabel("Salida turno tarde Martes").fill("20:00");
  await saveAndWait();

  await page.reload();
  await page.getByRole("tab", { name: "Horario de atención" }).click();
  await expect(page.locator("#open-2")).toBeChecked();
  await expect(page.getByLabel("Entrada Martes")).toHaveValue("08:00");
  await expect(page.getByLabel("Salida Martes")).toHaveValue("12:00");
  await expect(page.getByLabel("Entrada turno tarde Martes")).toHaveValue("14:00");
  await expect(page.getByLabel("Salida turno tarde Martes")).toHaveValue("20:00");

  // Leave it back the way the default seed left it, so other tests (and
  // the appointments grid) aren't affected by this one.
  await page.getByRole("button", { name: "Quitar segundo turno Martes" }).click();
  await page.getByLabel("Entrada Martes").fill("09:00");
  await page.getByLabel("Salida Martes").fill("18:00");
  await saveAndWait();
});
