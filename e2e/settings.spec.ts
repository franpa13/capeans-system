import { test, expect, type Page } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

const WEEKDAY_IDS: Record<string, number> = {
  Lunes: 1,
  Martes: 2,
  Miércoles: 3,
  Jueves: 4,
  Viernes: 5,
  Sábado: 6,
  Domingo: 0,
};

type DaySnapshot =
  | { isOpen: false }
  | {
      isOpen: true;
      openTime1: string;
      closeTime1: string;
      hasSecondShift: boolean;
      openTime2?: string;
      closeTime2?: string;
    };

async function readDay(page: Page, label: string): Promise<DaySnapshot> {
  const isOpen = await page.locator(`#open-${WEEKDAY_IDS[label]}`).isChecked();
  if (!isOpen) return { isOpen: false };
  const openTime1 = await page.getByLabel(`Entrada ${label}`).inputValue();
  const closeTime1 = await page.getByLabel(`Salida ${label}`).inputValue();
  const hasSecondShift = (await page.getByLabel(`Entrada turno tarde ${label}`).count()) > 0;
  if (!hasSecondShift) return { isOpen: true, openTime1, closeTime1, hasSecondShift: false };
  const openTime2 = await page.getByLabel(`Entrada turno tarde ${label}`).inputValue();
  const closeTime2 = await page.getByLabel(`Salida turno tarde ${label}`).inputValue();
  return { isOpen: true, openTime1, closeTime1, hasSecondShift: true, openTime2, closeTime2 };
}

/** Drives the form to match `snapshot` exactly — local only, same as any
 * other edit in this form; a separate saveAll() persists it. Used both to
 * set up a distinctive test schedule and to restore whatever was there
 * before, since this touches the same shared dev DB a person may be
 * clicking around in by hand. */
async function writeDay(page: Page, label: string, snapshot: DaySnapshot) {
  const toggle = page.locator(`#open-${WEEKDAY_IDS[label]}`);
  if ((await toggle.isChecked()) !== snapshot.isOpen) {
    await toggle.click();
  }

  if (snapshot.isOpen) {
    await page.getByLabel(`Entrada ${label}`).fill(snapshot.openTime1);
    await page.getByLabel(`Salida ${label}`).fill(snapshot.closeTime1);

    const hasShiftNow = (await page.getByLabel(`Entrada turno tarde ${label}`).count()) > 0;
    if (snapshot.hasSecondShift && !hasShiftNow) {
      await page.getByRole("button", { name: `Agregar segundo turno ${label}` }).click();
    }
    if (!snapshot.hasSecondShift && hasShiftNow) {
      await page.getByRole("button", { name: `Quitar segundo turno ${label}` }).click();
    }
    if (snapshot.hasSecondShift) {
      await page.getByLabel(`Entrada turno tarde ${label}`).fill(snapshot.openTime2!);
      await page.getByLabel(`Salida turno tarde ${label}`).fill(snapshot.closeTime2!);
    }
  }
}

/** One save for the whole week's drafts, via the single "Guardar cambios"
 * button — mirrors how a person would use the form, instead of a per-day
 * save that no longer exists. Counts the 7 parallel per-weekday save
 * requests directly rather than polling "enabled" (races React's
 * re-render — a disabled state too brief to observe lets that check pass
 * before anything actually saved) or networkidle (the dev server's own
 * background traffic, e.g. HMR, means the page may never truly go idle). */
async function saveAll(page: Page) {
  let settled = 0;
  const onResponse = (res: import("@playwright/test").Response) => {
    if (res.request().method() === "POST" && res.url().includes("/dashboard/configuracion")) {
      settled++;
    }
  };
  page.on("response", onResponse);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  // Generous timeout: under the full suite's parallel workers all hitting
  // one dev server, 7 concurrent writes can take a while longer than they
  // would in isolation.
  await expect.poll(() => settled, { timeout: 20000 }).toBeGreaterThanOrEqual(7);
  page.off("response", onResponse);
}

test("an insurance option can be added, renamed, and deleted from Configuración", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({
    page,
    emailAddress: process.env.E2E_TEST_EMAIL!,
  });

  const label = `Obra Social E2E ${Date.now()}`;
  const renamed = `${label} (renombrada)`;

  await page.goto("/dashboard/configuracion");
  await page
    .getByPlaceholder("Agregar nuevo...")
    .first()
    .fill(label);
  await page.getByRole("button", { name: "Agregar" }).first().click();
  // Search by its own label, not just plain visibility — this list is
  // paginated and a clinic's real obras sociales can already span more
  // than one page, so a freshly added item isn't guaranteed to land on
  // page 1 on its own.
  await page.getByPlaceholder("Buscar...").fill(label);
  await expect(page.getByText(label, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: `Editar ${label}` }).click();
  await page.getByRole("textbox", { name: "Editar valor" }).fill(renamed);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(renamed, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: `Eliminar ${renamed}` }).click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.getByText(renamed, { exact: true })).not.toBeVisible();

  // The new option is immediately selectable on the Pacientes form.
  const anotherLabel = `Obra Social E2E ${Date.now()}`;
  await page.getByPlaceholder("Agregar nuevo...").first().fill(anotherLabel);
  await page.getByRole("button", { name: "Agregar" }).first().click();
  await page.getByPlaceholder("Buscar...").fill(anotherLabel);
  await expect(page.getByText(anotherLabel, { exact: true })).toBeVisible();

  await page.goto("/dashboard/pacientes");
  await page.getByRole("button", { name: "Nuevo paciente" }).click();
  await page.getByLabel("Obra social").click();
  await expect(page.getByRole("option", { name: anotherLabel })).toBeVisible();
});

test("business hours can be closed for a day and persist after reload", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard/configuracion");
  await page.getByRole("tab", { name: "Horario de atención" }).click();

  // Tuesday (weekday 2) starts open with default hours seeded — but don't
  // assume that's still true (a previous run's cleanup step may not have
  // run if it failed partway through); force a known starting state.
  if (!(await page.locator("#open-2").isChecked())) {
    await page.locator("#open-2").click();
    await page.getByLabel("Entrada Martes").fill("09:00");
    await page.getByLabel("Salida Martes").fill("18:00");
  }
  await saveAll(page);

  // Now close it.
  await page.locator("#open-2").click();
  await expect(page.getByLabel("Entrada Martes")).toHaveCount(0);
  await saveAll(page);

  await page.reload();
  await page.getByRole("tab", { name: "Horario de atención" }).click();
  await expect(page.locator("#open-2")).not.toBeChecked();
  await expect(page.getByLabel("Entrada Martes")).toHaveCount(0);

  // Reopen it with a lunch-break split, and confirm that persists too.
  await page.locator("#open-2").click();
  await page.getByLabel("Entrada Martes").fill("08:00");
  await page.getByLabel("Salida Martes").fill("12:00");
  await page.getByRole("button", { name: "Agregar segundo turno Martes" }).click();
  await page.getByLabel("Entrada turno tarde Martes").fill("14:00");
  await page.getByLabel("Salida turno tarde Martes").fill("20:00");
  await saveAll(page);

  await page.reload();
  await page.getByRole("tab", { name: "Horario de atención" }).click();
  await expect(page.locator("#open-2")).toBeChecked();
  await expect(page.getByLabel("Entrada Martes")).toHaveValue("08:00");
  await expect(page.getByLabel("Salida Martes")).toHaveValue("12:00");
  await expect(page.getByLabel("Entrada turno tarde Martes")).toHaveValue("14:00");
  await expect(page.getByLabel("Salida turno tarde Martes")).toHaveValue("20:00");

  // Leave it back the way the default seed left it, so other tests (and
  // the appointments grid) aren't affected by this one.
  await page.getByRole("button", { name: "Quitar segundo turno Martes" }).click();
  await page.getByLabel("Entrada Martes").fill("09:00");
  await page.getByLabel("Salida Martes").fill("18:00");
  await saveAll(page);
});

test("Aplicar a todas copies one day's schedule onto the rest of the week", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard/configuracion");
  await page.getByRole("tab", { name: "Horario de atención" }).click();

  const LABELS = Object.keys(WEEKDAY_IDS);

  // Snapshot every day exactly as it is now — this runs against the same
  // dev DB a person may have hand-configured (e.g. a custom split shift),
  // so "restore" means "put back what was really there", not some
  // assumed default.
  const before: Record<string, DaySnapshot> = {};
  for (const label of LABELS) before[label] = await readDay(page, label);

  try {
    // A schedule unlikely to already match any other day, so picking it
    // up elsewhere can only be this button's doing.
    await writeDay(page, "Jueves", {
      isOpen: true,
      openTime1: "08:15",
      closeTime1: "13:45",
      hasSecondShift: false,
    });

    // Aplicar a todas only updates the in-form drafts (same as typing into
    // any other field here) — it takes a real Guardar cambios to persist.
    await page
      .getByRole("button", { name: "Aplicar horario de Jueves a todos los días" })
      .click();
    await saveAll(page);

    await page.reload();
    await page.getByRole("tab", { name: "Horario de atención" }).click();

    for (const label of LABELS.filter((l) => l !== "Jueves")) {
      await expect(page.locator(`#open-${WEEKDAY_IDS[label]}`)).toBeChecked();
      await expect(page.getByLabel(`Entrada ${label}`)).toHaveValue("08:15");
      await expect(page.getByLabel(`Salida ${label}`)).toHaveValue("13:45");
    }
  } finally {
    // Always restore, even if an assertion above failed.
    for (const label of LABELS) {
      await writeDay(page, label, before[label]);
    }
    await saveAll(page);
  }
});

test("a long list of tratamientos gets pagination and a working search", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard/configuracion");
  await page.getByRole("tab", { name: "Tratamientos" }).click();

  // A unique prefix so this test's own entries are unambiguous no matter
  // how much other test data has accumulated in this shared dev DB.
  const prefix = `Pag E2E ${Date.now()}`;
  const labels = Array.from({ length: 11 }, (_, i) => `${prefix} ${String(i).padStart(2, "0")}`);

  try {
    for (const label of labels) {
      await page.getByPlaceholder("Agregar nuevo...").fill(label);
      await page.getByRole("button", { name: "Agregar" }).click();
      // Confirm via its own unique label, not just list visibility — the
      // clinic's pre-existing tratamientos can already be close to a full
      // page, so a freshly added item can land on page 2 and never show
      // up on page 1 at all.
      await page.getByPlaceholder("Buscar...").fill(label);
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    // Narrow to just this test's 11 entries — more than the page size (10),
    // so pagination should now be offered where it wasn't before.
    await page.getByPlaceholder("Buscar...").fill(prefix);
    await expect(page.getByText("Página 1 de 2")).toBeVisible();
    await expect(page.getByText(labels[0], { exact: true })).toBeVisible();
    await expect(page.getByText(labels[10], { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByText("Página 2 de 2")).toBeVisible();
    await expect(page.getByText(labels[10], { exact: true })).toBeVisible();

    // A search matching nothing says so instead of silently showing an
    // empty list.
    await page.getByPlaceholder("Buscar...").fill(`${prefix} zzz-no-match`);
    await expect(page.getByText(/Ninguna opción coincide con/)).toBeVisible();
  } finally {
    // Ascending label order matches the list's own sort order, and the
    // list resets to page 1 every time it shrinks (usePagination resets
    // on any items-array change) — so each label in turn is always
    // reachable on page 1 without separately paging to find it.
    await page.getByPlaceholder("Buscar...").fill(prefix);
    for (const label of labels) {
      await page.getByRole("button", { name: `Eliminar ${label}` }).click();
      await page.getByRole("button", { name: "Eliminar", exact: true }).click();
      await expect(page.getByText(label, { exact: true })).toHaveCount(0);
    }
  }
});
