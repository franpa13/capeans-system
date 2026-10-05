import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

test("the odontogram on a patient page is read-only: clicking it does nothing", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

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
  await page.waitForTimeout(5000); // let the ~16MB model load and the camera auto-fit settle
  const box = await canvas.boundingBox();
  if (!box) throw new Error("3D odontogram canvas not found");

  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.34);
  await page.waitForTimeout(500);

  // Clicking the model doesn't open a consultation dialog or any tooth
  // picker — the odontogram here is a read-only treatment summary.
  await expect(page.locator("#tooth")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(pageErrors).toHaveLength(0);
});

test("the odontogram inside Nueva consulta shows whichever tooth is typed, and ignores clicks", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();

  // Collapsed by default: no 3D canvas until the button is pressed.
  await expect(page.locator("canvas")).toHaveCount(0);

  await page.fill("#tooth", "16");
  await expect(page.getByRole("button", { name: "Ver pieza 16" })).toBeVisible();
  await page.getByRole("button", { name: "Ver pieza 16" }).click();
  await page.getByText("Vista de la pieza 16.", { exact: false }).waitFor();

  const canvas = page.locator("canvas");
  await canvas.waitFor();
  await page.waitForTimeout(5000); // let the ~16MB model load and the camera auto-fit settle
  const box = await canvas.boundingBox();
  if (!box) throw new Error("3D odontogram canvas not found");

  // Clicking inside the viewer must not change the selection or close it —
  // the "Pieza dental" field is the only way to choose a tooth now.
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.34);
  await page.waitForTimeout(500);
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator("#tooth")).toHaveValue("16");

  expect(pageErrors).toHaveLength(0);
});
