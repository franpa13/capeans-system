import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";
import { createPatient } from "./patient-form";
import { openFichaSection } from "./ficha";

test("an orden asks for studies with a tap, prints on the signed sheet and goes by WhatsApp", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const stamp = Date.now();
  const professionalName = `Andrés Benítez E2E ${stamp}`;
  await page.goto("/dashboard/configuracion?tab=professionals");
  await page.getByRole("button", { name: "Nuevo profesional" }).click();
  const form = page.getByRole("dialog", { name: "Nuevo profesional" });
  await form.locator("#professionalTitle").click();
  await page.getByRole("option", { name: "Dr.", exact: true }).click();
  await form.locator("#professionalName").fill(professionalName);
  await form.locator("#professionalLicense").fill("MN 77001");
  await form.getByRole("button", { name: "Guardar" }).click();
  await expect(form).toHaveCount(0);

  try {
    const patientName = `Paciente Orden E2E ${stamp}`;
    await createPatient(page, patientName, "341 555-9876");
    await openFichaSection(page, "Órdenes");
    await expect(page.getByText("Todavía no se le hicieron órdenes.")).toBeVisible();

    await page.getByRole("button", { name: "Nueva orden" }).click();
    const dialog = page.getByRole("dialog", { name: "Nueva orden" });
    await dialog.locator("#orderProfessional").click();
    await page.getByRole("option", { name: `Dr. ${professionalName}` }).click();

    // Imaging: a panorámica and a periapical, completing its tooth.
    const options = dialog.getByRole("group", { name: "Opciones" });
    await options.getByRole("button", { name: "Radiografía panorámica" }).click();
    await options.getByRole("button", { name: "Radiografía periapical de la pieza" }).click();
    const asked = dialog.getByRole("region", { name: "Se solicita" });
    await expect(asked.getByText("Completá el número de pieza")).toBeVisible();
    await asked.getByLabel("Pedido 2").fill("Radiografía periapical de la pieza 16");
    await expect(asked.getByText("Completá el número de pieza")).toHaveCount(0);

    // Switching kind starts the list over.
    await dialog.getByRole("button", { name: "Laboratorio" }).click();
    await expect(asked).toHaveCount(0);
    await dialog.getByRole("button", { name: "Estudios por imágenes" }).click();
    await options.getByRole("button", { name: "Radiografía panorámica" }).click();
    await dialog.getByLabel("Otro pedido").fill("Radiografía oclusal superior");
    await dialog.getByRole("button", { name: "Agregar", exact: true }).click();
    await dialog.locator("#orderDiagnosis").fill("Evaluación de terceros molares");
    await dialog.getByRole("button", { name: "Crear orden" }).click();

    await expect(page).toHaveURL(/\/ordenes\/[^/]+$/);
    await expect(page.getByRole("heading", { name: /^Orden ORD-\d{8}$/ })).toBeVisible();
    const sheet = page.getByRole("article", { name: "Orden" });
    for (const text of [
      "Estudios por imágenes",
      "Solicito:",
      "Radiografía panorámica",
      "Radiografía oclusal superior",
      "Evaluación de terceros molares",
      patientName,
      "Matrícula MN 77001",
    ]) {
      await expect(sheet.getByText(text, { exact: false }).first()).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Imprimir / PDF" })).toHaveAttribute("href", /^\/imprimir\/orden\//);
    await expect(page.getByRole("link", { name: "Enviar por WhatsApp" })).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/5493415559876\?text=.*panor/,
    );

    await page.getByRole("link", { name: "Volver" }).click();
    await expect(page.getByRole("cell", { name: /Radiografía oclusal superior/ })).toBeVisible();
    await page.getByRole("link", { name: /^Ver orden ORD-/ }).click();
    await page.getByRole("button", { name: "Eliminar" }).click();
    await page.getByRole("button", { name: "Eliminar", exact: true }).last().click();
    await expect(page.getByText("Todavía no se le hicieron órdenes.")).toBeVisible();
  } finally {
    await page.goto("/dashboard/configuracion?tab=professionals");
    await page.getByRole("button", { name: `Eliminar ${professionalName}` }).click();
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(page.getByText(professionalName)).toHaveCount(0);
  }
});
