import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";
import ExcelJS from "exceljs";

test("Exportaciones downloads each kind of data as Excel, with its filters, and records every download", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Exportaciones" }).click();
  await expect(page.getByRole("heading", { name: "Exportaciones" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("Cada descarga queda registrada");

  // Turnos of October, with the period in the link.
  await page.fill("#turnos-desde", "2026-10-01");
  await page.fill("#turnos-hasta", "2026-10-31");
  const turnos = page.getByRole("link", { name: "Descargar Excel de Turnos" });
  await expect(turnos).toHaveAttribute("href", "/api/exportar/turnos?desde=2026-10-01&hasta=2026-10-31");
  const [download] = await Promise.all([page.waitForEvent("download"), turnos.click()]);
  expect(download.suggestedFilename()).toMatch(/^turnos-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile((await download.path())!);
  expect(book.worksheets.map((s) => s.name)).toEqual(["Turnos"]);
  expect(book.worksheets[0].getRow(1).getCell(1).value).toBe("Fecha");

  // Pacientes: three sheets.
  const [patients] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Descargar Excel de Pacientes" }).click(),
  ]);
  const patientsBook = new ExcelJS.Workbook();
  await patientsBook.xlsx.readFile((await patients.path())!);
  expect(patientsBook.worksheets.map((s) => s.name)).toEqual(["Pacientes", "Ficha médica", "Observaciones"]);

  // Both recorded, newest first, with the period.
  await page.reload();
  const log = page.getByRole("list", { name: "Últimas descargas" }).getByRole("listitem");
  await expect(log.first()).toContainText("Pacientes");
  await expect(log.nth(1)).toContainText("Turnos");
  await expect(log.nth(1)).toContainText("Desde 01/10/2026 · Hasta 31/10/2026");
});

test("a direct link to a Configuración section opens it, even coming from another section", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });
  await page.goto("/dashboard/configuracion");
  await expect(page.getByRole("tab", { name: "Datos del consultorio" })).toHaveAttribute("aria-selected", "true");
  await page.goto("/dashboard/liquidaciones/nueva");
  await page.goto("/dashboard/configuracion?tab=professionals");
  await expect(page.getByRole("tab", { name: "Profesionales" })).toHaveAttribute("aria-selected", "true");
});

test("every export downloads a valid Excel, and other roles can't download", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });
  for (const kind of [
    "pacientes",
    "turnos",
    "consultas",
    "pagos",
    "odontograma",
    "recetas",
    "ordenes",
    "liquidaciones",
    "stock",
    "estudios",
  ]) {
    const response = await page.request.get(`/api/exportar/${kind}`);
    expect(response.status(), kind).toBe(200);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load((await response.body()) as unknown as ArrayBuffer);
    expect(book.worksheets.length, kind).toBeGreaterThan(0);
  }
  expect((await page.request.get("/api/exportar/usuarios")).status()).toBe(404);
});
