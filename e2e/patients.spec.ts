import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";
import { createPatient } from "./patient-form";
import { fichaHeading, openFichaSection } from "./ficha";

test("a created patient survives a full page reload", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({
    page,
    emailAddress: process.env.E2E_TEST_EMAIL!,
  });

  const patientName = `Paciente E2E ${Date.now()}`;

  await createPatient(page, patientName, "11 0000-0000");
  // With pagination, a new patient isn't necessarily on the first page
  // (the list sorts alphabetically) — search for it like a real user would.
  // The server action's post-mutation refresh can land after the fill and
  // wipe the typed search text, so retry the fill until it sticks instead
  // of gambling on a fixed delay.
  await page.goto("/dashboard/pacientes");
  await expect(async () => {
    await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
    await expect(page.getByRole("link", { name: patientName })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });

  await page.reload();
  await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
  await expect(page.getByRole("link", { name: patientName })).toBeVisible();
});

test("filtering by obra social narrows the list via the backend", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({
    page,
    emailAddress: process.env.E2E_TEST_EMAIL!,
  });

  const patientName = `Paciente Obra E2E ${Date.now()}`;

  await createPatient(page, patientName, "11 9999-9999", async () => {
    await page.locator("#insurance").click();
    await page.getByRole("option", { name: "OSDE", exact: true }).click();
  });
  await page.goto("/dashboard/pacientes");
  await expect(async () => {
    await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
    await expect(page.getByRole("link", { name: patientName })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });

  // Add the obra social filter on top of the name filter (not instead of
  // it): with many past runs' same-named-prefix, same-obra-social patients
  // accumulated in the dev DB, obra alone doesn't guarantee this one lands
  // on page 1 of the (alphabetically sorted) results — keeping the name
  // filter active keeps the match unique regardless of accumulated data.
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "OSDE", exact: true }).click();
  await expect(page).toHaveURL(/obra=OSDE/);
  await expect(page.getByRole("link", { name: patientName })).toBeVisible();

  // Both filters show as independently removable chips; removing the
  // obra social one clears just that filter, leaving the name filter (and
  // its own chip) in place.
  const chip = page.getByRole("button", { name: "Quitar filtro Obra social: OSDE" });
  await expect(chip).toBeVisible();
  await expect(page.getByRole("button", { name: `Quitar filtro Nombre: ${patientName}` })).toBeVisible();
  await chip.click();
  await expect(page).not.toHaveURL(/obra=/);
  await expect(page.getByRole("link", { name: patientName })).toBeVisible();

  // Re-apply the filter to continue checking it narrows correctly.
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "OSDE", exact: true }).click();
  await expect(page).toHaveURL(/obra=OSDE/);

  // A different obra social should not match this patient (the name
  // filter is still active, so this isn't just "no results on this page").
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Swiss Medical", exact: true }).click();
  await expect(page).toHaveURL(/obra=Swiss/);
  await expect(page.getByRole("link", { name: patientName })).toHaveCount(0);

  await page.getByRole("button", { name: "Limpiar filtros" }).click();
  await expect(page).not.toHaveURL(/obra=/);
});

test("a minimal patient's detail page explains the info card is empty instead of showing a blank box", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const patientName = `Paciente Minimo E2E ${Date.now()}`;

  await createPatient(page, patientName, "11 4444-0000");
  await page.goto("/dashboard/pacientes");
  await expect(async () => {
    await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
    await expect(page.getByRole("link", { name: patientName })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });

  await page.getByRole("link", { name: patientName }).click();
  await expect(fichaHeading(page, patientName)).toBeVisible();
  await openFichaSection(page, "Ficha médica");
  await expect(
    page.getByText("Todavía no se cargaron más datos de este paciente."),
  ).toBeVisible();

  // Filling in a field later (Editar, from the Pacientes list) replaces
  // that message with the real data.
  await page.goto("/dashboard/pacientes");
  await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
  await page.getByRole("button", { name: `Acciones para ${patientName}` }).click();
  await page.getByRole("menuitem", { name: "Editar" }).click();
  await expect(page).toHaveURL(/\/editar$/);
  await page.fill("#dni", "30.123.456");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(fichaHeading(page, patientName)).toBeVisible();
  await expect(page.getByText("DNI 30.123.456", { exact: false })).toBeVisible();
  await openFichaSection(page, "Ficha médica");
  await expect(page.getByText("Todavía no se cargaron más datos de este paciente.")).toHaveCount(0);
});

test("a patient's medical history is saved and warned about in the ficha and the consulta form", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const patientName = `Paciente Antecedentes E2E ${Date.now()}`;
  await createPatient(page, patientName, "11 0000-0000", async () => {
    await page.fill("#insuranceNumber", "998877/02");
    await page.getByRole("tab", { name: "Información médica" }).click();
    await page.fill("#allergies", "penicilina");
    await page.getByRole("checkbox", { name: "Toma anticoagulantes" }).check();
    await page.getByRole("checkbox", { name: "Diabetes" }).check();
    await page.fill("#medications", "Sintrom 4mg");
  });

  // The ficha leads with the warning, and lists the rest of the data.
  const alert = page.getByRole("alert").filter({ hasText: "Antecedentes" });
  await expect(alert.getByText("Alergia: penicilina")).toBeVisible();
  await expect(alert.getByText("Toma anticoagulantes")).toBeVisible();
  await expect(alert.getByText("Diabetes")).toBeVisible();
  await expect(page.getByText("998877/02")).toBeVisible();
  await openFichaSection(page, "Ficha médica");
  await expect(page.getByText("Sintrom 4mg")).toBeVisible();

  // Registering a consulta for them shows the same warning.
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  const consulta = page.getByRole("dialog", { name: "Nueva consulta" });
  await expect(consulta.getByRole("alert").getByText("Toma anticoagulantes")).toBeVisible();
  await consulta.getByRole("button", { name: "Close" }).click();

  // Editing keeps the boxes checked, and unchecking one clears it.
  await page.getByRole("link", { name: "Editar", exact: true }).click();
  await page.getByRole("tab", { name: "Información médica" }).click();
  await expect(page.getByRole("checkbox", { name: "Toma anticoagulantes" })).toBeChecked();
  await page.getByRole("checkbox", { name: "Diabetes" }).uncheck();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(fichaHeading(page, patientName)).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Antecedentes" }).getByText("Diabetes")).toHaveCount(0);
});

test("radiografías and fotos can be uploaded to the ficha, viewed and deleted; disguised files are refused", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const patientName = `Paciente Rx E2E ${Date.now()}`;
  await createPatient(page, patientName, "11 0000-1111");
  await page.goto("/dashboard/pacientes");
  await expect(async () => {
    await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
    await expect(page.getByRole("link", { name: patientName })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
  await page.getByRole("link", { name: patientName }).first().click();
  await openFichaSection(page, "Estudios");

  const files = page.getByRole("region", { name: "Radiografías y fotos" });
  await expect(files.getByText("Todavía no hay radiografías ni fotos")).toBeVisible();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
  await files.getByLabel("Subir radiografías o fotos").setInputFiles([
    { name: "panoramica.png", mimeType: "image/png", buffer: png },
    { name: "truco.png", mimeType: "image/png", buffer: Buffer.from("<html><script>alert(1)</script>") },
  ]);
  const image = files.getByRole("img", { name: "panoramica.png" });
  await expect(image).toBeVisible();
  await expect(
    files.getByText("truco.png: Solo se pueden subir imágenes (JPG, PNG, WEBP, GIF) o archivos PDF"),
  ).toBeVisible();

  // The image is served to this clinic, as the type detected on upload.
  const src = (await image.getAttribute("src"))!;
  const response = await page.request.get(src);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");

  await files.getByRole("button", { name: "Borrar panoramica.png" }).click();
  await page.getByRole("button", { name: "Borrar", exact: true }).click();
  // While the dialog is open the page behind it is hidden from role
  // queries, so wait for the empty state rather than the image's absence.
  await expect(files.getByText("Todavía no hay radiografías ni fotos")).toBeVisible();
  await expect(image).toHaveCount(0);
  expect((await page.request.get(src)).status()).toBe(404);
});

test("the Nuevo paciente page saves the full profile across its tabs and the ficha shows it", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  // Nombre and apellido are required: saving without them stays on the
  // first tab and says so.
  await page.goto("/dashboard/pacientes/nuevo");
  await page.getByRole("tab", { name: "Notas y origen" }).click();
  await page.getByRole("button", { name: "Crear paciente" }).click();
  await expect(page.getByText("Ingresá el apellido")).toBeVisible();

  const lastName = `Perfil${Date.now()}`;
  await page.fill("#firstName", "Lucía");
  await page.fill("#lastName", lastName);
  await page.fill("#phone", "11 6666-7777");
  await page.fill("#insurancePlan", "310");
  await page.fill("#insuranceHolder", "Marcos Pérez");
  await page.fill("#holderRelationship", "Hija");
  await page.fill("#taxId", "27-12345678-3");
  await page.fill("#city", "Rosario");
  await page.fill("#province", "Santa Fe");
  await page.fill("#emergencyName", "Marcos Pérez");
  await page.fill("#emergencyPhone", "11 2222-1111");
  await page.getByRole("tab", { name: "Información médica" }).click();
  await page.locator("#bloodType").click();
  await page.getByRole("option", { name: "A+", exact: true }).click();
  await page.fill("#bloodPressure", "130/85");
  await page.fill("#medicalHistory", "Operada de apendicitis");
  await page.getByRole("tab", { name: "Notas y origen" }).click();
  await page.locator("#referralSource").click();
  await page.getByRole("option", { name: "Redes sociales" }).click();
  await page.getByRole("checkbox", { name: "Acepta recordatorios por WhatsApp" }).uncheck();
  await page.getByRole("button", { name: "Crear paciente" }).click();

  // Lands on the new ficha, with everything grouped.
  await expect(page.getByRole("heading", { level: 1, name: `${lastName}, Lucía` })).toBeVisible();
  await openFichaSection(page, "Ficha médica");
  for (const text of [
    "310",
    "Marcos Pérez",
    "27-12345678-3",
    "Rosario, Santa Fe",
    "A+",
    "130/85",
    "Operada de apendicitis",
    "Redes sociales",
    "No acepta recordatorios",
  ]) {
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
  }

  // Editar opens the same page with everything filled in.
  await page.getByRole("link", { name: "Editar", exact: true }).click();
  await expect(page.locator("#lastName")).toHaveValue(lastName);
  await expect(page.locator("#taxId")).toHaveValue("27-12345678-3");
});

test("the ficha opens on Resumen, with personal data, observaciones that can be added and deleted, and its other sections", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const patientName = `Paciente Ficha E2E ${Date.now()}`;
  await createPatient(page, patientName, "341 555-1234", async () => {
    await page.fill("#dni", "31.255.441");
    await page.fill("#email", "ficha@example.com");
  });

  await expect(fichaHeading(page, patientName)).toBeVisible();
  await expect(page.getByText("DNI 31.255.441", { exact: false })).toBeVisible();
  await expect(page.getByText("Activo", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: `Escribir por WhatsApp a ${patientName}` })).toHaveAttribute(
    "href",
    "https://wa.me/5493415551234",
  );
  await expect(page.getByText("ficha@example.com")).toBeVisible();
  await expect(page.getByText("Todavía no tiene turnos.")).toBeVisible();

  // Observaciones: added with today's date, newest first, and deletable.
  const box = page.getByLabel("Nueva observación");
  await box.fill("Prefiere turnos a la tarde");
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(box).toHaveValue("");
  const notes = page.getByRole("list", { name: "Observaciones" });
  const first = notes.getByRole("listitem").filter({ hasText: "Prefiere turnos a la tarde" });
  await expect(first).toContainText(
    new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }),
  );
  await box.fill("Viene con su hija");
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(notes.getByRole("listitem").first()).toContainText("Viene con su hija");

  await page.getByRole("button", { name: 'Borrar la observación "Prefiere turnos a la tarde"' }).click();
  await page.getByRole("button", { name: "Borrar", exact: true }).click();
  await expect(first).toHaveCount(0);
  await expect(page.getByText("Viene con su hija")).toBeVisible();

  // The other sections.
  await openFichaSection(page, "Pagos");
  await expect(page.getByText("Todavía no hay pagos registrados.")).toBeVisible();
  await openFichaSection(page, "Tratamientos");
  await expect(page.getByText("Todavía no hay consultas registradas para este paciente.")).toBeVisible();
});
