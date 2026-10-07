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

  // Add the obra social filter on top of the name filter (not instead of
  // it): with many past runs' same-named-prefix, same-obra-social patients
  // accumulated in the dev DB, obra alone doesn't guarantee this one lands
  // on page 1 of the (alphabetically sorted) results — keeping the name
  // filter active keeps the match unique regardless of accumulated data.
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "OSDE", exact: true }).click();
  await expect(page).toHaveURL(/obra=OSDE/);
  await expect(page.getByRole("link", { name: patientName })).toBeVisible();

  // Both filters show as independently removable chips; removing the
  // obra social one clears just that filter, leaving the name filter (and
  // its own chip) in place.
  const chip = page.getByRole("button", { name: "Quitar filtro Obra social: OSDE" });
  await expect(chip).toBeVisible();
  await expect(page.getByRole("button", { name: `Quitar filtro Nombre: ${patientName}` })).toBeVisible();
  await chip.click();
  await expect(page).not.toHaveURL(/obra=/);
  await expect(page.getByRole("link", { name: patientName })).toBeVisible();

  // Re-apply the filter to continue checking it narrows correctly.
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "OSDE", exact: true }).click();
  await expect(page).toHaveURL(/obra=OSDE/);

  // A different obra social should not match this patient (the name
  // filter is still active, so this isn't just "no results on this page").
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Swiss Medical", exact: true }).click();
  await expect(page).toHaveURL(/obra=Swiss/);
  await expect(page.getByRole("link", { name: patientName })).toHaveCount(0);

  await page.getByRole("button", { name: "Limpiar filtros" }).click();
  await expect(page).not.toHaveURL(/obra=/);
});
