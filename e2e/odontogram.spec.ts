import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

test("clicking a tooth focuses it with an info panel; confirming it pre-fills the consultation", async ({
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
  await page.waitForTimeout(5000); // let the ~16MB model load and the camera auto-fit settle (generous: WebGL contends with other parallel E2E workers)
  const box = await canvas.boundingBox();
  if (!box) throw new Error("3D odontogram canvas not found");

  // An upper tooth, found by sweeping real clicks against this camera/
  // Bounds setup (see tooth-chart-3d.tsx and ARCH_CALIBRATION in
  // odontogram.ts, fitted to the real "/teeth/teeth.glb" model).
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.34);

  // Clicking only focuses the tooth (camera zooms in) and opens an info
  // panel — it does not select it yet.
  await page.getByText("Sin consultas registradas en esta pieza.").waitFor();
  await expect(page.locator("#tooth")).toHaveCount(0);

  await page.getByRole("button", { name: "Usar esta pieza" }).click();

  const toothInput = page.locator("#tooth");
  await expect(toothInput).toBeVisible();
  const toothValue = await toothInput.inputValue();
  expect(toothValue).toMatch(/^[1-4][1-8]$/); // a valid FDI number
});

test("opening the odontogram from Nueva consulta shows it as a separate modal, closing once a tooth is confirmed", async ({
  page,
}) => {
  // The modal closing itself the instant a tooth is confirmed used to
  // unmount the Canvas (and drei's Html-portaled tooth labels inside
  // it) synchronously in the same tick as the click — React: "Attempted
  // to synchronously unmount a root while React was already rendering."
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();

  // Collapsed by default: no 3D canvas until the button is pressed.
  await expect(page.locator("canvas")).toHaveCount(0);

  await page.getByRole("button", { name: "Agregar odontograma" }).click();
  await page
    .getByText("Click en un diente para verlo de cerca y elegirlo como pieza dental.")
    .waitFor();
  const canvas = page.locator("canvas");
  await canvas.waitFor();
  await page.waitForTimeout(5000); // let the ~16MB model load and the camera auto-fit settle
  const box = await canvas.boundingBox();
  if (!box) throw new Error("3D odontogram canvas not found");

  // Same fraction as the standalone card test — both share the same
  // camera/Bounds setup in tooth-chart-3d.tsx.
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.34);
  await page.getByRole("button", { name: "Usar esta pieza" }).waitFor();

  // The modal stays open while the tooth is only focused — the odontogram
  // is still here, just zoomed in with its info panel.
  await expect(page.locator("canvas")).toHaveCount(1);

  await page.getByRole("button", { name: "Usar esta pieza" }).click();

  // Confirming closes the odontogram modal, and the Nueva consulta form
  // underneath reflects the selection.
  await expect(page.locator("canvas")).toHaveCount(0);
  const toothInput = page.locator("#tooth");
  await expect(toothInput).toBeVisible();
  const toothValue = await toothInput.inputValue();
  expect(toothValue).toMatch(/^[1-4][1-8]$/);
  await expect(
    page.getByRole("button", { name: `Odontograma (pieza ${toothValue})` }),
  ).toBeVisible();

  await page.waitForTimeout(500); // let any deferred unmount settle
  expect(pageErrors).toHaveLength(0);
});
