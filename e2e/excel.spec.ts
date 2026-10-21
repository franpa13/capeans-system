import { test, expect, type Page } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";
import ExcelJS from "exceljs";

async function xlsx(headers: string[], rows: (string | number)[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Hoja");
  sheet.addRow(headers);
  rows.forEach((r) => sheet.addRow(r));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function readDownload(page: Page, click: () => Promise<void>) {
  const download = page.waitForEvent("download");
  await click();
  const file = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of file) chunks.push(chunk as Buffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.concat(chunks) as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  const values: string[][] = [];
  sheet.eachRow((row) => values.push((row.values as unknown[]).slice(1).map((v) => String(v ?? ""))));
  return { name: (await download).suggestedFilename(), values };
}

test("patients can be imported from Excel (skipping duplicates, reporting bad rows) and downloaded", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const stamp = Date.now();
  const ana = `Import Ana ${stamp}`;
  const beto = `Import Beto ${stamp}`;
  const file = await xlsx(
    ["Nombre", "Teléfono", "DNI", "Obra social", "Alergias"],
    [
      // Unique per run: an earlier run's patient with the same DNI would
      // (correctly) make this row a duplicate.
      [ana, "11 2222-3333", String(stamp).slice(-8), "OSDE", "penicilina"],
      [beto, 1144445555, "", "", ""],
      [`Import Sin Tel ${stamp}`, "", "", "", ""],
      [ana, "11 2222-3333", "", "", ""],
    ],
  );

  await page.goto("/dashboard/pacientes");
  await page.getByRole("button", { name: "Importar Excel" }).click();
  const dialog = page.getByRole("dialog", { name: "Importar pacientes" });
  await expect(dialog.getByRole("link", { name: "Descargar plantilla" })).toHaveAttribute(
    "href",
    "/api/excel/plantilla/pacientes",
  );
  await dialog.getByLabel("Archivo de Excel (.xlsx)").setInputFiles({
    name: "pacientes.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: file,
  });
  await dialog.getByRole("button", { name: "Importar" }).click();
  await expect(dialog.getByText("Se cargaron 2 pacientes")).toBeVisible();
  await expect(dialog.getByText("Fila 4: Falta el teléfono")).toBeVisible();
  await expect(dialog.getByText(`Fila 5: Ya existe ${ana} con ese teléfono`)).toBeVisible();
  await dialog.getByRole("button", { name: "Listo" }).click();

  // The download respects the list's filter: only this run's patients.
  await expect(async () => {
    await page.getByPlaceholder("Buscar por nombre...").fill(`Import Ana ${stamp}`);
    await expect(page).toHaveURL(new RegExp(`q=Import`));
    await expect(page.getByRole("link", { name: ana })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
  const { name, values } = await readDownload(page, () =>
    page.getByRole("link", { name: "Descargar Excel" }).click(),
  );
  expect(name).toMatch(/^pacientes-\d{4}-\d{2}-\d{2}\.xlsx$/);
  expect(values[0].slice(0, 2)).toEqual(["Nombre", "Teléfono"]);
  expect(values.slice(1).map((r) => r[0])).toEqual([ana]);
  expect(values[1][8]).toBe("penicilina");
});

test("insumos and tratamientos can be imported, and Stock, Consultas and Ingresos downloaded", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });
  const stamp = Date.now();

  // Insumos: one valid row, one with a thousands separator.
  await page.goto("/dashboard/stock");
  await page.getByRole("button", { name: "Importar Excel" }).click();
  const supplies = page.getByRole("dialog", { name: "Importar insumos" });
  await supplies.getByLabel("Archivo de Excel (.xlsx)").setInputFiles({
    name: "insumos.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await xlsx(
      ["Nombre", "Unidad", "Precio", "Stock"],
      [
        [`Import Guantes ${stamp}`, "caja", 4500, 12],
        [`Import Malo ${stamp}`, "caja", "4.500", 1],
      ],
    ),
  });
  await supplies.getByRole("button", { name: "Importar" }).click();
  await expect(supplies.getByText("Se cargó 1 insumo")).toBeVisible();
  await expect(supplies.getByText("Fila 3: Precio: tiene que ser un número entero, sin puntos ni comas")).toBeVisible();
  await supplies.getByRole("button", { name: "Listo" }).click();
  await page.getByPlaceholder("Buscar...").fill(`Import Guantes ${stamp}`);
  await expect(page.locator("tbody").getByText("12 caja")).toBeVisible();

  const stock = await readDownload(page, () => page.getByRole("link", { name: "Descargar Excel" }).click());
  expect(stock.values[0]).toEqual(["Nombre", "Unidad", "Precio", "Stock", "Avisar cuando queden", "Estado"]);
  expect(stock.values.some((r) => r[0] === `Import Guantes ${stamp}` && r[3] === "12")).toBe(true);

  // Cleanup the insumo.
  await page.getByRole("button", { name: `Acciones para Import Guantes ${stamp}` }).click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();

  // Tratamientos: a new one with its price.
  await page.goto("/dashboard/configuracion");
  await page.getByRole("tab", { name: "Tratamientos" }).click();
  await page.getByRole("button", { name: "Importar Excel" }).click();
  const treatments = page.getByRole("dialog", { name: "Importar tratamientos" });
  await treatments.getByLabel("Archivo de Excel (.xlsx)").setInputFiles({
    name: "tratamientos.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await xlsx(["Nombre", "Precio"], [[`Import Trat ${stamp}`, 7777]]),
  });
  await treatments.getByRole("button", { name: "Importar" }).click();
  await expect(treatments.getByText("Se cargó 1 tratamiento")).toBeVisible();
  await treatments.getByRole("button", { name: "Listo" }).click();
  await page.getByPlaceholder("Buscar por nombre o código...").fill(`Import Trat ${stamp}`);
  await expect(page.getByText("7.777", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: `Eliminar Import Trat ${stamp}` }).click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();

  // Consultas and Ingresos download with their own columns.
  await page.goto("/dashboard/consultas");
  const consultas = await readDownload(page, () => page.getByRole("link", { name: "Descargar Excel" }).click());
  expect(consultas.values[0]).toEqual([
    "Fecha", "Paciente", "Tratamiento", "Dientes", "Monto", "Pagado", "Saldo", "Estado del cobro", "Observaciones",
  ]);
  await page.goto("/dashboard/ingresos");
  const ingresos = await readDownload(page, () => page.getByRole("link", { name: "Descargar Excel" }).click());
  expect(ingresos.name).toMatch(/^ingresos-\d{4}-\d{2}\.xlsx$/);
  expect(ingresos.values[0]).toEqual(["Fecha", "Paciente", "Tratamiento", "Medio de pago", "Monto"]);
});
