import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";
import { createPatient } from "./patient-form";
import { openFichaSection } from "./ficha";

test("a professional signs by drawing, and a receta warns about allergies, prints with the signature and goes by WhatsApp", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const stamp = Date.now();
  const professionalName = `Valeria Moretti E2E ${stamp}`;

  // Configuración › Profesionales: the letterhead and a professional who
  // signs on the pad.
  await page.goto("/dashboard/configuracion?tab=clinic");
  await page.fill("#clinicAddress", "San Juan 3169, Rosario");
  await page.fill("#clinicPhone", "341 232-3232");
  await page.getByRole("button", { name: "Guardar datos" }).click();
  await expect(page.getByText("Guardado.")).toBeVisible();
  await page.getByRole("tab", { name: "Profesionales" }).click();

  await page.getByRole("button", { name: "Nuevo profesional" }).click();
  const form = page.getByRole("dialog", { name: "Nuevo profesional" });
  await form.locator("#professionalName").fill(professionalName);
  await form.locator("#professionalLicense").fill("MP 41236");
  const pad = form.getByRole("img", { name: "Dibujá la firma acá" });
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.6);
  await page.mouse.down();
  for (const [x, y] of [
    [0.3, 0.3],
    [0.4, 0.7],
    [0.55, 0.35],
    [0.7, 0.65],
    [0.8, 0.4],
  ]) {
    await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 5 });
  }
  await page.mouse.up();
  await expect(form.getByText("Si no te gusta, tocá “Borrar firma”")).toBeVisible();
  await form.getByRole("button", { name: "Guardar" }).click();
  await expect(form).toHaveCount(0);
  await expect(page.getByRole("img", { name: `Firma de ${professionalName}` })).toBeVisible();

  try {
    // A patient allergic to penicillin.
    const patientName = `Paciente Receta E2E ${stamp}`;
    await createPatient(page, patientName, "341 555-1234", async () => {
      await page.getByRole("tab", { name: "Información médica" }).click();
      await page.fill("#allergies", "Penicilina");
    });
    await openFichaSection(page, "Recetas");
    await expect(page.getByText("Todavía no se le hicieron recetas.")).toBeVisible();

    await page.getByRole("button", { name: "Nueva receta" }).click();
    const dialog = page.getByRole("dialog", { name: "Nueva receta" });
    await dialog.locator("#prescriptionProfessional").click();
    await page.getByRole("option", { name: `Dra. ${professionalName}` }).click();

    // The post-extraction set brings amoxicilina: the allergy is flagged.
    await dialog.getByRole("button", { name: "Post extracción" }).click();
    const warning = dialog.getByRole("alert");
    await expect(warning).toContainText("Es alérgico a la penicilina: Amoxicilina es una penicilina.");
    await dialog.getByRole("button", { name: "Quitar Amoxicilina" }).click();
    await expect(warning).toHaveCount(0);

    // Clindamicina instead, from the search.
    await dialog.locator("#medicationSearch").fill("clinda");
    await dialog.getByRole("button", { name: /Clindamicina 300 mg/ }).click();
    await expect(dialog.getByLabel("Indicaciones de Clindamicina")).toHaveValue(
      "1 cápsula cada 6 horas durante 7 días.",
    );
    await dialog.getByRole("button", { name: "Crear receta" }).click();

    // The receta: letterhead, patient, Rp/, signature.
    await expect(page).toHaveURL(/\/recetas\/[^/]+$/);
    await expect(page.getByRole("heading", { name: /^Receta REC-\d{8}$/ })).toBeVisible();
    const sheet = page.getByRole("article", { name: "Receta" });
    for (const text of [
      "Rp/",
      patientName,
      "Clindamicina 300 mg",
      "Ibuprofeno 600 mg",
      "Clorhexidina enjuague bucal 0,12 %",
      "San Juan 3169, Rosario",
      "Matrícula MP 41236",
    ]) {
      await expect(sheet.getByText(text, { exact: false }).first()).toBeVisible();
    }
    await expect(sheet.getByRole("img", { name: `Firma de ${professionalName}` })).toBeVisible();
    await expect(page.getByRole("link", { name: "Imprimir / PDF" })).toHaveAttribute(
      "href",
      /^\/imprimir\/receta\//,
    );
    await expect(page.getByRole("link", { name: "Enviar por WhatsApp" })).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/5493415551234\?text=.*Clindamicina/,
    );

    // Back on the ficha's Recetas, it's listed; deleting it empties it.
    await page.getByRole("link", { name: "Volver" }).click();
    await expect(page.getByRole("cell", { name: /Clindamicina 300 mg/ })).toBeVisible();
    await page.getByRole("link", { name: /^Ver receta REC-/ }).click();
    await page.getByRole("button", { name: "Eliminar" }).click();
    await page.getByRole("button", { name: "Eliminar", exact: true }).last().click();
    await expect(page.getByText("Todavía no se le hicieron recetas.")).toBeVisible();
  } finally {
    await page.goto("/dashboard/configuracion?tab=professionals");
    await page.getByRole("button", { name: `Eliminar ${professionalName}` }).click();
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(page.getByText(professionalName)).toHaveCount(0);
  }
});
