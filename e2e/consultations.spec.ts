import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";
import { addClinicOption, editClinicOption } from "./clinic-options";

// With pagination (10/page) and backend filtering, a newly created
// consultation isn't guaranteed to land on page 1 of the unfiltered,
// date-desc list once a long test session accumulates dozens of
// same-day consultations — search for it by patient name like a real
// user would. The retry (not a single fill) guards against the same
// race as patient search: createConsultationAction's revalidatePath can
// land after the fill and wipe the typed filter text.
//
// The URL check has to be INSIDE the retry loop, not a separate
// assertion after it: a freshly created consultation is often already
// visible on the unfiltered page 1 (it's the most recent), so the
// visibility check alone can pass on the very first attempt even when
// that same remount wiped the fill before its debounced navigation
// fired — leaving the filter never actually applied.
async function createConsultationAndFindIt(
  page: import("@playwright/test").Page,
  patientName: string,
) {
  await expect(async () => {
    await page.locator("#filter-patient").fill(patientName);
    await expect(page.locator("tbody").getByText(patientName)).toBeVisible({ timeout: 1000 });
    await expect(page).toHaveURL(/paciente=/, { timeout: 1000 });
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

test("a consultation's amount, discount, and payment status work end to end", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const treatmentLabel = `Cobro E2E ${Date.now()}`;
  await page.goto("/dashboard/configuracion");
  await page.getByRole("tab", { name: "Tratamientos" }).click();
  await addClinicOption(page, "tratamiento", treatmentLabel, "10000");

  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Agregar paciente nuevo" }).click();
  const patientName = `Paciente Cobro E2E ${Date.now()}`;
  await page.fill("#newPatientName", patientName);
  await page.fill("#newPatientPhone", "11 8888-8888");
  await page.getByRole("combobox").nth(3).click();
  await page.getByRole("option", { name: treatmentLabel }).click();

  // Precio de lista prefilled, discount recalculates it.
  await expect(page.getByText("10.000", { exact: false })).toBeVisible();
  await page.fill("#discountPercent", "20");
  await expect(page.locator("#amountCharged")).toHaveValue("8000");

  await page.getByRole("button", { name: "Parcial" }).click();
  await page.fill("#partialAmountPaid", "3000");
  await page.getByRole("button", { name: "Guardar" }).click();
  await createConsultationAndFindIt(page, patientName);

  const row = page.locator("tbody tr", { hasText: patientName });
  await expect(row.getByText("Parcial", { exact: false })).toBeVisible();
  await expect(row.getByText("8.000", { exact: false })).toBeVisible();

  // Patient balance reflects the $5.000 still owed.
  await row.getByRole("link", { name: patientName }).click();
  await expect(page.getByText("Debe: ", { exact: false })).toBeVisible();
  await expect(page.getByText("5.000", { exact: false })).toBeVisible();

  // Mark it fully paid from the Editar dialog and confirm the balance clears.
  await page.goto("/dashboard/consultas");
  await page.locator("#filter-patient").fill(patientName);
  const editRow = page.locator("tbody tr", { hasText: patientName });
  await editRow.getByRole("button", { name: "Editar consulta" }).click();
  await page.getByRole("button", { name: "Cobrado", exact: true }).click();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Editar consulta")).toHaveCount(0);
  await expect(editRow.getByText("Cobrado", { exact: false })).toBeVisible();

  await editRow.getByRole("link", { name: patientName }).click();
  await expect(page.getByText("Debe: ", { exact: false })).toHaveCount(0);
  await page.goto("/dashboard/consultas");

  // The Estado de cobro filter actually narrows, not just the patient
  // filter that was already applied: Pendiente must hide this now-Cobrado
  // row, and Cobrado must show it.
  await page.locator("#filter-patient").fill(patientName);
  await page.locator('div:has(> label:text("Estado de cobro")) button').click();
  await page.getByRole("option", { name: "Pendiente", exact: true }).click();
  await expect(page.locator("tbody").getByText(patientName)).toHaveCount(0);

  await page.locator('div:has(> label:text("Estado de cobro")) button').click();
  await page.getByRole("option", { name: "Cobrado", exact: true }).click();
  await expect(page.locator("tbody").getByText(patientName)).toBeVisible();
  await page.getByRole("button", { name: "Limpiar filtros" }).click();

  // Cleanup: delete the consultation and the treatment option.
  await page.locator("#filter-patient").fill(patientName);
  await editRow.getByRole("button", { name: "Eliminar consulta" }).click();
  await page.getByText("¿Eliminar esta consulta?").waitFor();
  await page.getByRole("button", { name: "Eliminar", exact: true }).last().click();
  await expect(page.locator("tbody").getByText(patientName)).toHaveCount(0);

  await page.goto("/dashboard/configuracion");
  await page.getByRole("tab", { name: "Tratamientos" }).click();
  await page.getByPlaceholder("Buscar...").fill(treatmentLabel);
  await page.getByRole("button", { name: `Eliminar ${treatmentLabel}` }).click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
});

test("opening Editar on an unpriced consultation does not bill it at the treatment's current price", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  // The treatment starts with NO price, so the consultation saves with no
  // amount (the auto-fill effect never fires — there's no listPrice yet).
  const treatmentLabel = `SinPrecio E2E ${Date.now()}`;
  await page.goto("/dashboard/configuracion");
  await page.getByRole("tab", { name: "Tratamientos" }).click();
  await addClinicOption(page, "tratamiento", treatmentLabel);

  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Agregar paciente nuevo" }).click();
  const patientName = `Paciente SinPrecio E2E ${Date.now()}`;
  await page.fill("#newPatientName", patientName);
  await page.fill("#newPatientPhone", "11 9999-9999");
  await page.getByRole("combobox").nth(3).click();
  await page.getByRole("option", { name: treatmentLabel }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await createConsultationAndFindIt(page, patientName);

  const row = page.locator("tbody tr", { hasText: patientName });
  await expect(row.getByText("$", { exact: false })).toHaveCount(0);

  // Now price the treatment retroactively — the spec requires this to never
  // affect a consultation that already happened without a price.
  await page.goto("/dashboard/configuracion");
  await page.getByRole("tab", { name: "Tratamientos" }).click();
  await page.getByPlaceholder("Buscar...").fill(treatmentLabel);
  await editClinicOption(page, "tratamiento", treatmentLabel, { price: "30000" });
  await expect(page.getByText("30.000", { exact: false })).toBeVisible();

  // Open Editar on the old consultation and save without touching anything.
  await page.goto("/dashboard/consultas");
  await page.locator("#filter-patient").fill(patientName);
  await row.getByRole("button", { name: "Editar consulta" }).click();
  // Confirms listPrice really is truthy at mount (the dialog's own "Precio
  // de lista" block is a plain conditional render, no effect involved) —
  // otherwise the scenario below would prove nothing.
  await expect(page.getByText("Precio de lista")).toBeVisible();
  // Forces a wait for the dialog's effects to settle before saving — a
  // buggy auto-prefill effect would turn this into "30000".
  await expect(page.locator("#edit-amountCharged")).toHaveValue("");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Editar consulta")).toHaveCount(0);

  // Still no amount/badge — the retroactive price must not have billed it.
  await expect(row.getByText("$", { exact: false })).toHaveCount(0);

  // Cleanup.
  await row.getByRole("button", { name: "Eliminar consulta" }).click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).last().click();
  await page.goto("/dashboard/configuracion");
  await page.getByRole("tab", { name: "Tratamientos" }).click();
  await page.getByPlaceholder("Buscar...").fill(treatmentLabel);
  await page.getByRole("button", { name: `Eliminar ${treatmentLabel}` }).click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
});

test("the discount recalculates when switching treatments, clamps to 0-100, and clears for an unpriced treatment", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const labelA = `Discount A E2E ${Date.now()}`;
  const labelB = `Discount B E2E ${Date.now()}`;
  await page.goto("/dashboard/configuracion");
  await page.getByRole("tab", { name: "Tratamientos" }).click();
  for (const [label, price] of [
    [labelA, "10000"],
    [labelB, "20000"],
  ]) {
    await addClinicOption(page, "tratamiento", label, price);
  }
  await page.getByPlaceholder("Buscar...").fill("");

  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option").first().click();
  await page.getByText("Elegí un tratamiento").click();
  await page.getByRole("option", { name: labelA, exact: true }).click();

  // Discount 20% on A ($10.000) -> $8.000.
  await page.fill("#discountPercent", "20");
  await expect(page.locator("#amountCharged")).toHaveValue("8000");

  // Switch to B ($20.000) — the SAME 20% discount must apply to B's
  // price, not leave A's stale $8.000 behind.
  await page.getByRole("combobox").filter({ hasText: labelA }).click();
  await page.getByRole("option", { name: labelB, exact: true }).click();
  await expect(page.locator("#amountCharged")).toHaveValue("16000");

  // A discount over 100 must not produce a negative amount.
  await page.fill("#discountPercent", "150");
  await expect(page.locator("#amountCharged")).toHaveValue("0");

  // Switching to an unpriced treatment clears the amount instead of
  // leaving a stale figure that doesn't correspond to anything priced.
  await page.getByRole("combobox").filter({ hasText: labelB }).click();
  await page.getByRole("option", { name: "Otro", exact: true }).click();
  await expect(page.locator("#amountCharged")).toHaveValue("");

  await page.keyboard.press("Escape");

  // Cleanup.
  for (const label of [labelA, labelB]) {
    await page.goto("/dashboard/configuracion");
    await page.getByRole("tab", { name: "Tratamientos" }).click();
    await page.getByPlaceholder("Buscar...").fill(label);
    await page.getByRole("button", { name: `Eliminar ${label}` }).click();
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  }
});

test("adding, editing, and removing insumos on a consultation reconciles stock correctly", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const supplyName = `Insumo Reconcile E2E ${Date.now()}`;
  const stockRow = page.locator("li", { hasText: supplyName });
  const expectStock = async (text: string) => {
    await page.goto("/dashboard/stock");
    await page.getByPlaceholder("Buscar...").fill(supplyName);
    await expect(stockRow.getByText(text, { exact: true })).toBeVisible();
  };

  await page.goto("/dashboard/stock");
  await page.getByRole("button", { name: "Nuevo insumo" }).click();
  const newSupply = page.getByRole("dialog", { name: "Nuevo insumo" });
  await newSupply.getByLabel("Nombre").fill(supplyName);
  await newSupply.getByLabel("Unidad").fill("unidad");
  await newSupply.getByLabel("Stock inicial").fill("100");
  await newSupply.getByRole("button", { name: "Guardar" }).click();
  await expect(newSupply).toHaveCount(0);
  await expectStock("100 unidad");

  const patientName = `Paciente Stock E2E ${Date.now()}`;
  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Agregar paciente nuevo" }).click();
  await page.fill("#newPatientName", patientName);
  await page.fill("#newPatientPhone", "11 2222-3333");
  await page.getByText("Elegí un tratamiento").click();
  await page.getByRole("option", { name: "Limpieza" }).click();
  await page.locator("#supplySelect").click();
  await page.getByRole("option", { name: new RegExp(supplyName) }).click();
  await page.fill("#supplyQuantity", "10");
  await page.getByRole("button", { name: "Agregar insumo" }).click();
  await expect(page.getByText(`${supplyName} × 10 unidad`)).toBeVisible();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await createConsultationAndFindIt(page, patientName);

  await expectStock("90 unidad");

  // Edit: the form comes back with 10 used; change it to 5.
  await page.goto("/dashboard/consultas");
  await createConsultationAndFindIt(page, patientName);
  const row = page.locator("tbody tr", { hasText: patientName });
  await row.getByRole("button", { name: "Editar consulta" }).click();
  await expect(page.getByText(`${supplyName} × 10 unidad`)).toBeVisible();
  await page.getByRole("button", { name: `Quitar ${supplyName}` }).click();
  await page.locator("#edit-supplySelect").click();
  await page.getByRole("option", { name: new RegExp(supplyName) }).click();
  await page.fill("#edit-supplyQuantity", "5");
  await page.getByRole("button", { name: "Agregar insumo" }).click();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("dialog", { name: "Editar consulta" })).toHaveCount(0);

  // 100 - 5, not 100 - 10 - 5: the old usage went back before the new one applied.
  await expectStock("95 unidad");

  // Deleting the consulta puts its insumos back.
  await page.goto("/dashboard/consultas");
  await createConsultationAndFindIt(page, patientName);
  await row.getByRole("button", { name: "Eliminar consulta" }).click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).last().click();
  await expect(page.locator("tbody").getByText(patientName)).toHaveCount(0);

  await expectStock("100 unidad");

  // Cleanup the insumo (no longer in use, so deletable).
  await page.getByRole("button", { name: `Eliminar ${supplyName}` }).click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.getByText(supplyName, { exact: true })).toHaveCount(0);
});

test("an insumo picked but not added to the list blocks saving instead of being silently dropped", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  const save = page.getByRole("button", { name: "Guardar", exact: true });

  await page.locator("#supplySelect").click();
  await page.getByRole("option").first().click();
  await page.fill("#supplyQuantity", "3");
  await expect(page.getByText("Tocá «Agregar insumo» para sumarlo a la lista")).toBeVisible();
  await expect(save).toBeDisabled();

  await page.getByRole("button", { name: "Agregar insumo" }).click();
  await expect(page.getByText("Tocá «Agregar insumo» para sumarlo a la lista")).toHaveCount(0);
  await expect(save).toBeEnabled();
});
