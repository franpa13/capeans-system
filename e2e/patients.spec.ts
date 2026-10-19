import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

test("a created patient survives a full page reload", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({
    page,
    emailAddress: process.env.E2E_TEST_EMAIL!,
  });

  const patientName = `Paciente E2E ${Date.now()}`;

  await page.goto("/dashboard/pacientes");
  await page.getByRole("button", { name: "Nuevo paciente" }).click();
  await page.fill("#name", patientName);
  await page.fill("#phone", "11 0000-0000");
  await page.getByRole("button", { name: "Guardar" }).click();
  // With pagination, a new patient isn't necessarily on the first page
  // (the list sorts alphabetically) — search for it like a real user would.
  // The server action's post-mutation refresh can land after the fill and
  // wipe the typed search text, so retry the fill until it sticks instead
  // of gambling on a fixed delay.
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

  await page.goto("/dashboard/pacientes");
  await page.getByRole("button", { name: "Nuevo paciente" }).click();
  await page.fill("#name", patientName);
  await page.fill("#phone", "11 9999-9999");
  await page.locator("#insurance").click();
  await page.getByRole("option", { name: "OSDE", exact: true }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
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

  await page.goto("/dashboard/pacientes");
  await page.getByRole("button", { name: "Nuevo paciente" }).click();
  await page.fill("#name", patientName);
  await page.fill("#phone", "11 4444-0000");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(async () => {
    await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
    await expect(page.getByRole("link", { name: patientName })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });

  await page.getByRole("link", { name: patientName }).click();
  await expect(page.getByRole("heading", { name: patientName })).toBeVisible();
  await expect(
    page.getByText("Todavía no se cargaron más datos de este paciente."),
  ).toBeVisible();

  // Filling in a field later (from the Pacientes list, the only place
  // editing is offered today) replaces that message with the real data.
  await page.goto("/dashboard/pacientes");
  await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
  await page.getByRole("button", { name: `Acciones para ${patientName}` }).click();
  await page.getByRole("menuitem", { name: "Editar" }).click();
  await page.fill("#dni", "30.123.456");
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.getByRole("link", { name: patientName }).click();
  await expect(page.getByText("Todavía no se cargaron más datos de este paciente.")).toHaveCount(0);
  await expect(page.getByText("30.123.456")).toBeVisible();
});

test("a patient's medical history is saved and warned about in the ficha and the consulta form", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const patientName = `Paciente Antecedentes E2E ${Date.now()}`;
  await page.goto("/dashboard/pacientes");
  await page.getByRole("button", { name: "Nuevo paciente" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo paciente" });
  await page.fill("#name", patientName);
  await page.fill("#phone", "11 0000-0000");
  await page.fill("#insuranceNumber", "998877/02");
  await page.fill("#allergies", "penicilina");
  await dialog.getByRole("checkbox", { name: "Toma anticoagulantes" }).check();
  await dialog.getByRole("checkbox", { name: "Diabetes" }).check();
  await page.fill("#medications", "Sintrom 4mg");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(dialog).toHaveCount(0);

  await expect(async () => {
    await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
    await expect(page.getByRole("link", { name: patientName })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
  await page.getByRole("link", { name: patientName }).first().click();

  // The ficha leads with the warning, and lists the rest of the data.
  const alert = page.getByRole("alert").filter({ hasText: "Antecedentes" });
  await expect(alert.getByText("Alergia: penicilina")).toBeVisible();
  await expect(alert.getByText("Toma anticoagulantes")).toBeVisible();
  await expect(alert.getByText("Diabetes")).toBeVisible();
  await expect(page.getByText("998877/02")).toBeVisible();
  await expect(page.getByText("Sintrom 4mg")).toBeVisible();

  // Registering a consulta for them shows the same warning.
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  const consulta = page.getByRole("dialog", { name: "Nueva consulta" });
  await expect(consulta.getByRole("alert").getByText("Toma anticoagulantes")).toBeVisible();
  await consulta.getByRole("button", { name: "Close" }).click();

  // Editing keeps the boxes checked, and unchecking one clears it.
  await page.goto("/dashboard/pacientes");
  await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
  await page.getByRole("button", { name: `Acciones para ${patientName}` }).first().click();
  await page.getByRole("menuitem", { name: "Editar" }).click();
  const edit = page.getByRole("dialog", { name: "Editar paciente" });
  await expect(edit.getByRole("checkbox", { name: "Toma anticoagulantes" })).toBeChecked();
  await edit.getByRole("checkbox", { name: "Diabetes" }).uncheck();
  await edit.getByRole("button", { name: "Guardar" }).click();
  await expect(edit).toHaveCount(0);
  await page.getByRole("link", { name: patientName }).first().click();
  await expect(page.getByRole("alert").filter({ hasText: "Antecedentes" }).getByText("Diabetes")).toHaveCount(0);
});

test("radiografías and fotos can be uploaded to the ficha, viewed and deleted; disguised files are refused", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const patientName = `Paciente Rx E2E ${Date.now()}`;
  await page.goto("/dashboard/pacientes");
  await page.getByRole("button", { name: "Nuevo paciente" }).click();
  await page.fill("#name", patientName);
  await page.fill("#phone", "11 0000-1111");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo paciente" })).toHaveCount(0);
  await expect(async () => {
    await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
    await expect(page.getByRole("link", { name: patientName })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
  await page.getByRole("link", { name: patientName }).first().click();

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
  await expect(image).toHaveCount(0);
  expect((await page.request.get(src)).status()).toBe(404);
});
