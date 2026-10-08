import { test, expect, type Page } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// A fixed slot would collide with leftover appointments from previous
// runs — pick a random day (Mon..Sun, so it's within the calendar's
// default current-week view) and hour each run, same spirit as the
// timestamped patient names used elsewhere in these specs, but with
// enough spread that two runs seconds apart don't collide either.
// Minute-level (not just :00) so the slot space is 24*60 per day rather
// than 24 — after dozens of runs in one long session, whole hours get
// exhausted much faster than individual minutes do.
function randomTime() {
  return `${pad(Math.floor(Math.random() * 24))}:${pad(Math.floor(Math.random() * 60))}`;
}

function randomSlotInCurrentWeek() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(monday.getDate() + diffToMonday);

  const date = new Date(monday);
  date.setDate(date.getDate() + Math.floor(Math.random() * 7)); // Mon..Sun
  const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return { dateStr, timeStr: randomTime() };
}

function randomHourOn(date: Date) {
  const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return { dateStr, timeStr: randomTime() };
}

/** Fills the already-open "Nuevo turno" dialog's date/time and saves,
 * retrying with a freshly randomized slot if it collides with a leftover
 * appointment from an earlier run — the slot space is small enough that,
 * after many runs in one long session, an actually-free slot can't be
 * assumed on the first try. Returns the slot that was actually booked.
 *
 * Waits for a definitive outcome (the dialog closing, or the conflict
 * message appearing) rather than checking immediately after the click:
 * `locator.isVisible()` doesn't poll, so an instant check races the
 * server round-trip and reads a stale DOM — on the very first attempt
 * that reliably looks like success whether or not it actually was. */
async function saveAppointmentAvoidingConflicts(
  page: Page,
  pickSlot: () => { dateStr: string; timeStr: string },
) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const { dateStr, timeStr } = pickSlot();
    await page.fill("#date", dateStr);
    await page.fill("#time", timeStr);
    await page.getByRole("button", { name: "Guardar" }).click();

    const dialog = page.getByRole("dialog", { name: "Nuevo turno" });
    const conflict = page.getByText("Ya hay un turno agendado en ese horario");
    const outcome = await Promise.race([
      dialog.waitFor({ state: "hidden", timeout: 3000 }).then(() => "success" as const),
      conflict.waitFor({ state: "visible", timeout: 3000 }).then(() => "conflict" as const),
    ]).catch(() => "unknown" as const);

    if (outcome === "success") return { dateStr, timeStr };
  }
  throw new Error("Could not find a free appointment slot after 10 attempts");
}

test("a created appointment appears on the calendar, and double-booking the same slot is rejected", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({
    page,
    emailAddress: process.env.E2E_TEST_EMAIL!,
  });

  const patientName = `Paciente Turno E2E ${Date.now()}`;

  await page.goto("/dashboard/pacientes");
  await page.getByRole("button", { name: "Nuevo paciente" }).click();
  await page.fill("#name", patientName);
  await page.fill("#phone", "11 3333-3333");
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

  await page.goto("/dashboard/turnos");
  await page.getByRole("button", { name: "Nuevo turno", exact: true }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: patientName }).click();
  const { dateStr: date, timeStr: time } = await saveAppointmentAvoidingConflicts(
    page,
    randomSlotInCurrentWeek,
  );

  await expect(page.getByRole("button", { name: patientName })).toBeVisible();

  // Try to double-book that now-confirmed-taken exact slot with the same
  // patient.
  await page.getByRole("button", { name: "Nuevo turno", exact: true }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: patientName }).click();
  await page.fill("#date", date);
  await page.fill("#time", time);
  await page.getByRole("button", { name: "Guardar" }).click();

  await expect(page.getByText("Ya hay un turno agendado en ese horario")).toBeVisible();
});

test("the Día view shows a created appointment as a row with the patient name", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const patientName = `Paciente Dia E2E ${Date.now()}`;
  const today = new Date();

  await page.goto("/dashboard/pacientes");
  await page.getByRole("button", { name: "Nuevo paciente" }).click();
  await page.fill("#name", patientName);
  await page.fill("#phone", "11 1212-1212");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(async () => {
    await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
    await expect(page.getByRole("link", { name: patientName })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });

  // Today, so that switching to Día view (which defaults to today when
  // today falls inside the week being viewed) shows it without having to
  // navigate to a specific day first.
  await page.goto("/dashboard/turnos");
  await page.getByRole("button", { name: "Nuevo turno", exact: true }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: patientName }).click();
  await saveAppointmentAvoidingConflicts(page, () => randomHourOn(today));
  await expect(page.getByRole("button", { name: patientName })).toBeVisible();

  await page.getByRole("link", { name: "Diario", exact: true }).click();
  await expect(page).toHaveURL(/view=day/);
  await expect(page.getByText(patientName)).toBeVisible();

  await page.getByRole("link", { name: "Semanal", exact: true }).click();
  await expect(page).not.toHaveURL(/view=day/);
  await expect(page.getByRole("button", { name: patientName })).toBeVisible();
});
