import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

// With pagination (10/page) and backend filtering, a newly created
// consultation isn't guaranteed to land on page 1 of the unfiltered,
// date-desc list once a long test session accumulates dozens of
// same-day consultations — search for it by patient name like a real
// user would. The retry (not a single fill) guards against the same
// race as patient search: createConsultationAction's revalidatePath can
// land after the fill and wipe the typed filter text.
async function createConsultationAndFindIt(
  page: import("@playwright/test").Page,
  patientName: string,
) {
  await expect(async () => {
    await page.locator("#filter-patient").fill(patientName);
    await expect(page.locator("tbody").getByText(patientName)).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
}

test("a created consultation survives a full page reload", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({
    page,
    emailAddress: process.env.E2E_TEST_EMAIL!,
  });

  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Agregar paciente nuevo" }).click();
  const patientName = `Paciente Consulta E2E ${Date.now()}`;
  await page.fill("#newPatientName", patientName);
  await page.fill("#newPatientPhone", "11 1111-1111");
  // Combobox order in the dialog once "Agregar paciente nuevo" is selected:
  // 0 = Paciente, 1 = Obra social (inline new-patient fields),
  // 2 = Piezas dentales, 3 = Tratamiento realizado.
  await page.getByRole("combobox").nth(3).click();
  await page.getByRole("option", { name: "Limpieza" }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await createConsultationAndFindIt(page, patientName);

  await page.reload();
  await page.locator("#filter-patient").fill(patientName);
  await expect(page.locator("tbody").getByText(patientName)).toBeVisible();
});

test("the Editar action opens the row for editing, and changes persist", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Agregar paciente nuevo" }).click();
  const patientName = `Paciente Editar E2E ${Date.now()}`;
  await page.fill("#newPatientName", patientName);
  await page.fill("#newPatientPhone", "11 2222-2222");
  await page.getByRole("combobox").nth(3).click();
  await page.getByRole("option", { name: "Limpieza" }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await createConsultationAndFindIt(page, patientName);

  const row = page.locator("tbody tr", { hasText: patientName });
  await row.getByRole("button", { name: "Editar consulta" }).click();
  await page.getByText("Editar consulta").waitFor();
  await page.locator("#edit-notes").fill("Nota editada");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Editar consulta")).toHaveCount(0);
  await expect(row.getByText("Nota editada")).toBeVisible();
});

test("the Ver action opens a read-only detail view with the full observations", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Agregar paciente nuevo" }).click();
  const patientName = `Paciente Ver E2E ${Date.now()}`;
  await page.fill("#newPatientName", patientName);
  await page.fill("#newPatientPhone", "11 4444-4444");
  await page.getByRole("combobox").nth(3).click();
  await page.getByRole("option", { name: "Limpieza" }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await createConsultationAndFindIt(page, patientName);

  const row = page.locator("tbody tr", { hasText: patientName });
  await row.getByRole("button", { name: "Ver consulta" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Detalle de la consulta")).toBeVisible();
  await expect(dialog.getByText(patientName)).toBeVisible();

  // It's read-only — no inputs to type into, just a way back to editing.
  await expect(dialog.getByRole("button", { name: "Editar", exact: true })).toBeVisible();
  await expect(page.locator("#edit-notes")).toHaveCount(0);
});

test("deleting a consultation from the table removes it after confirming", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Agregar paciente nuevo" }).click();
  const patientName = `Paciente Borrar E2E ${Date.now()}`;
  await page.fill("#newPatientName", patientName);
  await page.fill("#newPatientPhone", "11 3333-3333");
  await page.getByRole("combobox").nth(3).click();
  await page.getByRole("option", { name: "Limpieza" }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await createConsultationAndFindIt(page, patientName);

  const row = page.locator("tbody tr", { hasText: patientName });
  await row.getByRole("button", { name: "Eliminar consulta" }).click();
  await page.getByText("¿Eliminar esta consulta?").waitFor();
  await page.getByRole("button", { name: "Eliminar", exact: true }).last().click();

  await expect(page.locator("tbody").getByText(patientName)).toHaveCount(0);
});

test("filtering by Paciente and Pieza narrows the list via the backend", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Agregar paciente nuevo" }).click();
  const patientName = `Paciente Filtro E2E ${Date.now()}`;
  await page.fill("#newPatientName", patientName);
  await page.fill("#newPatientPhone", "11 7777-7777");
  await page.locator("#teeth").click();
  await page.getByRole("option", { name: "16", exact: true }).click();
  await page.getByRole("combobox").nth(3).click();
  await page.getByRole("option", { name: "Limpieza" }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  // This also exercises the Paciente filter itself (see getConsultations),
  // which narrows the table to just this patient's consultation and
  // reflects in the URL.
  await createConsultationAndFindIt(page, patientName);
  await expect(page).toHaveURL(/paciente=/);

  // The Pieza filter matches a tooth exactly against the stored teeth
  // array — 16 was picked, 27 was not.
  await page.locator("#filter-tooth").fill("27");
  await expect(page).toHaveURL(/pieza=27/);
  await expect(page.locator("tbody").getByText(patientName)).toHaveCount(0);

  await page.locator("#filter-tooth").fill("16");
  await expect(page).toHaveURL(/pieza=16/);
  await expect(page.locator("tbody").getByText(patientName)).toBeVisible();

  await page.getByRole("button", { name: "Limpiar filtros" }).click();
  await expect(page).not.toHaveURL(/pieza=|paciente=/);
  await page.locator("#filter-patient").fill(patientName);
  await expect(page.locator("tbody").getByText(patientName)).toBeVisible();
});

test("the date range filter and active filter chips work end to end", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Agregar paciente nuevo" }).click();
  const patientName = `Paciente Fecha E2E ${Date.now()}`;
  await page.fill("#newPatientName", patientName);
  await page.fill("#newPatientPhone", "11 6666-6666");
  await page.getByRole("combobox").nth(3).click();
  await page.getByRole("option", { name: "Limpieza" }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await createConsultationAndFindIt(page, patientName);

  // Clear the Paciente filter and narrow by date instead — picking "today"
  // in the single range calendar (replacing the old separate Desde/Hasta
  // inputs) sets a complete one-day range and narrows the list via the
  // backend.
  await page.locator("#filter-patient").fill("");
  await page.getByRole("button", { name: "Rango de fechas" }).click();
  await page
    .locator('[data-slot="popover-content"]')
    .getByRole("button", { name: /^Today,/ })
    .click();
  await expect(page).toHaveURL(/desde=/);
  await expect(page).toHaveURL(/hasta=/);
  await page.locator("#filter-patient").fill(patientName);
  await expect(page.locator("tbody").getByText(patientName)).toBeVisible();

  // The active date filter shows as a removable chip alongside any other
  // active filters.
  const dateChip = page.getByRole("button", { name: /Quitar filtro Fecha/ });
  await expect(dateChip).toBeVisible();

  // Removing the chip clears just that filter, not the whole URL.
  await dateChip.click();
  await expect(page).not.toHaveURL(/desde=|hasta=/);
  await expect(page.locator("tbody").getByText(patientName)).toBeVisible();
});

test("a consultation records the time it was logged, not just the date", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Agregar paciente nuevo" }).click();
  const patientName = `Paciente Hora E2E ${Date.now()}`;
  await page.fill("#newPatientName", patientName);
  await page.fill("#newPatientPhone", "11 5555-5555");
  await page.fill("#time", "15:45");
  await page.getByRole("combobox").nth(3).click();
  await page.getByRole("option", { name: "Limpieza" }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await createConsultationAndFindIt(page, patientName);

  const row = page.locator("tbody tr", { hasText: patientName });
  await expect(row.getByText("15:45")).toBeVisible();
});
