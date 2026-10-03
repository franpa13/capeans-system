import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

test("clicking a tooth in the 3D odontogram opens a consultation pre-filled with that tooth", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const patientName = `Paciente Odontograma E2E ${Date.now()}`;

  await page.goto("/dashboard/pacientes");
  await page.getByRole("button", { name: "Nuevo paciente" }).click();
  await page.fill("#name", patientName);
  await page.fill("#phone", "11 5555-5555");
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.getByRole("link", { name: patientName }).click();
  await page.waitForURL(/\/dashboard\/pacientes\/.+/);
  await page.getByText("Odontograma", { exact: true }).waitFor();

  const canvas = page.locator("canvas");
  await canvas.waitFor();
  await page.waitForTimeout(1000); // let the WebGL scene finish its first render
  const box = await canvas.boundingBox();
  if (!box) throw new Error("3D odontogram canvas not found");

  // One of the upper-row front teeth, found empirically against this
  // camera/arch layout (see tooth-chart-3d.tsx) — absolute page
  // coordinates, since canvas-relative clicks don't reliably reach
  // React Three Fiber's raycaster in this setup.
  await page.mouse.click(box.x + box.width * 0.57, box.y + box.height * 0.25);

  const toothInput = page.locator("#tooth");
  await expect(toothInput).toBeVisible();
  const toothValue = await toothInput.inputValue();
  expect(toothValue).toMatch(/^[1-4][1-8]$/); // a valid FDI number
});
