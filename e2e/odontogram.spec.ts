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
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(pageErrors).toHaveLength(0);
});

test("the odontogram inside Nueva consulta is visible on the Adulto tab by default and ignores clicks; teeth are picked via the select", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();

  // The odontogram is shown by default — no button to open it.
  const canvas = page.locator("canvas");
  await canvas.waitFor();
  await page.waitForTimeout(5000); // let the ~16MB model load and the camera auto-fit settle

  // Pick two teeth from the "Piezas dentales" select; each becomes a chip.
  await page.locator("#teeth").click();
  await page.getByRole("option", { name: "16", exact: true }).click();
  await page.locator("#teeth").click();
  await page.getByRole("option", { name: "17", exact: true }).click();
  await expect(page.getByText("16", { exact: true })).toBeVisible();
  await expect(page.getByText("17", { exact: true })).toBeVisible();

  // Clicking inside the viewer must not change the selection — the
  // "Piezas dentales" select is the only way to choose teeth now.
  const box = await canvas.boundingBox();
  if (!box) throw new Error("3D odontogram canvas not found");
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.34);
  await page.waitForTimeout(500);
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Quitar pieza 16" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Quitar pieza 17" })).toBeVisible();

  // Chips can be removed directly, without touching the 3D view.
  await page.getByRole("button", { name: "Quitar pieza 16" }).click();
  await expect(page.getByRole("button", { name: "Quitar pieza 16" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Quitar pieza 17" })).toBeVisible();

  expect(pageErrors).toHaveLength(0);
});

test("the odontogram hides on the Niño tab — no 3D model for primary teeth yet", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });
  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();

  await expect(page.locator("canvas")).toHaveCount(1);

  await page.getByRole("tab", { name: "Niño" }).click();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.locator("#teeth-primary").click();
  await page.getByRole("option", { name: "55", exact: true }).click();
  await expect(page.locator("canvas")).toHaveCount(0);

  await page.getByRole("tab", { name: "Adulto" }).click();
  await expect(page.locator("canvas")).toHaveCount(1);
});

test("switching dentition tabs clears previously picked teeth", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });
  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();

  await page.locator("#teeth").click();
  await page.getByRole("option", { name: "14", exact: true }).click();
  await expect(page.getByRole("button", { name: "Quitar pieza 14" })).toBeVisible();

  await page.getByRole("tab", { name: "Niño" }).click();
  await expect(page.getByRole("button", { name: "Quitar pieza 14" })).toHaveCount(0);

  await page.locator("#teeth-primary").click();
  await page.getByRole("option", { name: "55", exact: true }).click();
  await expect(page.getByRole("button", { name: "Quitar pieza 55" })).toBeVisible();

  await page.getByRole("tab", { name: "Adulto" }).click();
  await expect(page.getByRole("button", { name: "Quitar pieza 55" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Quitar pieza 14" })).toHaveCount(0);
});
