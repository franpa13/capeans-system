import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

test("a created patient survives a full page reload", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({
    page,
    emailAddress: process.env.E2E_TEST_EMAIL!,
  });

  const patientName = `Paciente E2E ${Date.now()}`;

  await page.goto("/dashboard/pacientes");
  await page.getByRole("button", { name: "Nuevo paciente" }).click();
  await page.fill("#name", patientName);
  await page.fill("#phone", "11 0000-0000");
  await page.getByRole("button", { name: "Guardar" }).click();
  // With pagination, a new patient isn't necessarily on the first page
  // (the list sorts alphabetically) — search for it like a real user would.
  // The server action's post-mutation refresh can land after the fill and
  // wipe the typed search text, so retry the fill until it sticks instead
  // of gambling on a fixed delay.
  await expect(async () => {
    await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
    await expect(page.getByRole("link", { name: patientName })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });

  await page.reload();
  await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
  await expect(page.getByRole("link", { name: patientName })).toBeVisible();
});

test("filtering by obra social narrows the list via the backend", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({
    page,
    emailAddress: process.env.E2E_TEST_EMAIL!,
  });

  const patientName = `Paciente Obra E2E ${Date.now()}`;

  await page.goto("/dashboard/pacientes");
  await page.getByRole("button", { name: "Nuevo paciente" }).click();
  await page.fill("#name", patientName);
  await page.fill("#phone", "11 9999-9999");
  await page.locator("#insurance").click();
  await page.getByRole("option", { name: "OSDE", exact: true }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(async () => {
    await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
    await expect(page.getByRole("link", { name: patientName })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });

  // Clear the name filter and narrow by obra social instead — the exact
  // match is applied server-side in getPatients.
  await page.getByPlaceholder("Buscar por nombre...").fill("");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "OSDE", exact: true }).click();
  await expect(page).toHaveURL(/obra=OSDE/);
  await expect(page.getByRole("link", { name: patientName })).toBeVisible();

  // A different obra social should not match this patient.
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Swiss Medical", exact: true }).click();
  await expect(page).toHaveURL(/obra=Swiss/);
  await expect(page.getByRole("link", { name: patientName })).toHaveCount(0);

  await page.getByRole("button", { name: "Limpiar filtros" }).click();
  await expect(page).not.toHaveURL(/obra=/);
});
