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
  await expect(page.getByRole("link", { name: patientName })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("link", { name: patientName })).toBeVisible();
});
