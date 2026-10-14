import { test, expect, type Page } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Appointments default to 30 minutes, and findConflict rejects any
// overlap, so the real slot space for one day is 48 half-hour marks, not
// 24*60 individual minutes. After many runs in one long session, most of
// a given day's 48 marks (especially "today", reused by several tests)
// can already be taken — shuffled, non-repeating candidates guarantee
// every distinct mark is tried at most once, so this only fails if the
// whole day genuinely has no free slot left, not from bad luck retrying
// the same taken one twice.
function shuffledHalfHourSlotsOn(date: Date) {
  const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const slots = [0, 30].flatMap((minute) =>
    Array.from({ length: 24 }, (_, hour) => ({ dateStr, timeStr: `${pad(hour)}:${pad(minute)}` })),
  );
  return shuffled(slots);
}

// Pick a random day (Mon..Sun, so it's within the calendar's default
// current-week view) for each of its half-hour slots, same spirit as the
// timestamped patient names used elsewhere in these specs.
function shuffledHalfHourSlotsInCurrentWeek() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(monday.getDate() + diffToMonday);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
  return shuffled(days.flatMap((d) => shuffledHalfHourSlotsOn(d)));
}

/** Fills the already-open "Nuevo turno" dialog's date/time and saves,
 * trying each candidate slot in order until one isn't already taken by a
 * leftover appointment from an earlier run. Returns the slot that was
 * actually booked.
 *
 * Waits for a definitive outcome (the dialog closing, or the conflict
 * message appearing) rather than checking immediately after the click:
 * `locator.isVisible()` doesn't poll, so an instant check races the
 * server round-trip and reads a stale DOM — on the very first attempt
 * that reliably looks like success whether or not it actually was. */
async function saveAppointmentAvoidingConflicts(
  page: Page,
  candidates: { dateStr: string; timeStr: string }[],
) {
  for (const { dateStr, timeStr } of candidates) {
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
  throw new Error(`Could not find a free appointment slot among ${candidates.length} candidates`);
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
    shuffledHalfHourSlotsInCurrentWeek(),
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
  const { timeStr } = await saveAppointmentAvoidingConflicts(
    page,
    shuffledHalfHourSlotsOn(today),
  );
  await expect(page.getByRole("button", { name: patientName })).toBeVisible();

  await page.getByRole("link", { name: "Diario", exact: true }).click();
  await expect(page).toHaveURL(/view=day/);
  await expect(page.getByText(patientName)).toBeVisible();

  // Clicking the appointment bar opens a read-only detail view first, not
  // the edit form directly.
  await page.getByRole("button", { name: timeStr, exact: true }).click();
  const viewDialog = page.getByRole("dialog", { name: "Detalle del turno" });
  await expect(viewDialog).toBeVisible();
  await expect(viewDialog.getByText(patientName)).toBeVisible();
  await expect(viewDialog.locator("#edit-notes")).toHaveCount(0);

  // "Editar" switches to the actual edit form.
  await viewDialog.getByRole("button", { name: "Editar", exact: true }).click();
  const editDialog = page.getByRole("dialog", { name: "Editar turno" });
  await expect(editDialog).toBeVisible();
  await editDialog.locator("#reason").fill("Control de rutina");
  await editDialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(editDialog).toHaveCount(0);

  // The dialog closes as soon as the save request resolves, but
  // onSaved's router.refresh() is fire-and-forget — re-reading the bar
  // immediately would race it and see the pre-edit data. Wait for the
  // bar's own text to pick up the new reason before trusting it.
  const updatedBar = page.getByRole("button", { name: new RegExp(`^${timeStr}`) });
  await expect(updatedBar).toContainText("Control de rutina");

  // Re-opening the detail view shows the saved change.
  await updatedBar.click();
  const reopenedDialog = page.getByRole("dialog", { name: "Detalle del turno" });
  await expect(reopenedDialog).toBeVisible();
  await expect(reopenedDialog.getByText("Control de rutina")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("link", { name: "Semanal", exact: true }).click();
  await expect(page).not.toHaveURL(/view=day/);
  await expect(page.getByRole("button", { name: patientName })).toBeVisible();
});

test("a cancelled appointment is hidden from the grid by default, and the estado filter can show it", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const patientName = `Paciente Cancelado E2E ${Date.now()}`;

  await page.goto("/dashboard/pacientes");
  await page.getByRole("button", { name: "Nuevo paciente" }).click();
  await page.fill("#name", patientName);
  await page.fill("#phone", "11 7777-7777");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(async () => {
    await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
    await expect(page.getByRole("link", { name: patientName })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });

  await page.goto("/dashboard/turnos");
  // Default filter is "Turnos confirmados" — visible before cancelling.
  await expect(page.getByRole("combobox")).toHaveText("Turnos confirmados");
  await page.getByRole("button", { name: "Nuevo turno", exact: true }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: patientName }).click();
  await saveAppointmentAvoidingConflicts(page, shuffledHalfHourSlotsInCurrentWeek());
  await expect(page.getByRole("button", { name: patientName })).toBeVisible();

  // Cancel it — the weekly grid opens the edit form directly on click.
  await page.getByRole("button", { name: patientName }).click();
  await page.getByRole("button", { name: "Cancelar turno" }).click();
  await expect(page.getByRole("dialog", { name: "Editar turno" })).toHaveCount(0);

  // Hidden from the default (confirmed-only) view now.
  await expect(page.getByRole("button", { name: patientName })).toHaveCount(0);

  // Switching the filter to "Turnos cancelados" brings it back.
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Turnos cancelados", exact: true }).click();
  await expect(page).toHaveURL(/estado=CANCELLED/);
  await expect(page.getByRole("button", { name: patientName })).toBeVisible();

  // "Todos los turnos" shows it regardless of status.
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Todos los turnos", exact: true }).click();
  await expect(page).toHaveURL(/estado=ALL/);
  await expect(page.getByRole("button", { name: patientName })).toBeVisible();
});

test("a turno can be booked for a brand-new patient without leaving the dialog", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const patientName = `Paciente Turno Nuevo E2E ${Date.now()}`;

  await page.goto("/dashboard/turnos");
  await page.getByRole("button", { name: "Nuevo turno", exact: true }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Agregar paciente nuevo" }).click();
  await page.fill("#newPatientName", patientName);
  await page.fill("#newPatientPhone", "11 8888-8888");
  await saveAppointmentAvoidingConflicts(page, shuffledHalfHourSlotsInCurrentWeek());

  // The turno shows up with the new patient's name on the grid.
  await expect(page.getByRole("button", { name: patientName })).toBeVisible();

  // It's a real patient now, not just a name on the turno — findable from
  // Pacientes like any other.
  await page.goto("/dashboard/pacientes");
  await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
  await expect(page.getByRole("link", { name: patientName })).toBeVisible();
});

test("marking a turno as completed offers to log the consulta for that patient", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const patientName = `Paciente Completado E2E ${Date.now()}`;

  await page.goto("/dashboard/pacientes");
  await page.getByRole("button", { name: "Nuevo paciente" }).click();
  await page.fill("#name", patientName);
  await page.fill("#phone", "11 9999-9999");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(async () => {
    await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
    await expect(page.getByRole("link", { name: patientName })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });

  await page.goto("/dashboard/turnos");
  await page.getByRole("button", { name: "Nuevo turno", exact: true }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: patientName }).click();
  await page.fill("#reason", "Control anual");
  const slot = await saveAppointmentAvoidingConflicts(page, shuffledHalfHourSlotsInCurrentWeek());
  await expect(page.getByRole("button", { name: patientName })).toBeVisible();

  // The weekly grid opens the edit form directly on click.
  await page.getByRole("button", { name: patientName }).click();
  const editDialog = page.getByRole("dialog", { name: "Editar turno" });
  await editDialog.getByRole("button", { name: "Marcar como completado" }).click();
  await expect(editDialog).toHaveCount(0);

  // Not forced — a prompt offers logging the consulta, with the
  // patient's name, but it's dismissible.
  const prompt = page.getByRole("alertdialog", { name: "Turno completado" });
  await expect(prompt).toBeVisible();
  await expect(prompt.getByText(patientName)).toBeVisible();
  await prompt.getByRole("button", { name: "Registrar consulta" }).click();

  // Opens the same Nueva consulta dialog used elsewhere, patient fixed,
  // already linked to this turno and prefilled with its date, time and
  // motivo — not "now", which would be wrong for a turno logged later.
  const consultationDialog = page.getByRole("dialog", { name: "Nueva consulta" });
  await expect(consultationDialog).toBeVisible();
  await expect(consultationDialog.getByText(patientName)).toBeVisible();
  await expect(consultationDialog.locator("#date")).toHaveValue(slot.dateStr);
  await expect(consultationDialog.locator("#time")).toHaveValue(slot.timeStr);
  await expect(consultationDialog.locator("#notes")).toHaveValue("Control anual");
  await expect(consultationDialog.locator("#appointmentLink")).toContainText(slot.timeStr);
  await expect(consultationDialog.locator("#appointmentLink")).toContainText("Control anual");
  await consultationDialog.getByText("Elegí un tratamiento").click();
  await page.getByRole("option", { name: "Limpieza" }).click();
  await consultationDialog.getByRole("button", { name: "Guardar" }).click();
  await expect(consultationDialog).toHaveCount(0);

  // The turno itself is now completed — gone from the default
  // confirmed-only filter, visible under "Turnos completados", and marked
  // as having its consulta.
  await expect(page.getByRole("button", { name: patientName })).toHaveCount(0);
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Turnos completados", exact: true }).click();
  await expect(page).toHaveURL(/estado=COMPLETED/);
  const turno = page.getByRole("button", { name: patientName });
  await expect(turno).toBeVisible();
  await expect(turno.getByRole("img", { name: "Consulta registrada" })).toBeVisible();
});

test("a completed turno left without a consulta is flagged, and can be linked later from Consultas by its date", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const patientName = `Paciente Vincular E2E ${Date.now()}`;

  await page.goto("/dashboard/pacientes");
  await page.getByRole("button", { name: "Nuevo paciente" }).click();
  await page.fill("#name", patientName);
  await page.fill("#phone", "11 9999-8888");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(async () => {
    await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
    await expect(page.getByRole("link", { name: patientName })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });

  await page.goto("/dashboard/turnos");
  await page.getByRole("button", { name: "Nuevo turno", exact: true }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: patientName }).click();
  await page.fill("#reason", "Arreglo de caries");
  const slot = await saveAppointmentAvoidingConflicts(page, shuffledHalfHourSlotsInCurrentWeek());

  await page.getByRole("button", { name: patientName }).click();
  const editDialog = page.getByRole("dialog", { name: "Editar turno" });
  await editDialog.getByRole("button", { name: "Marcar como completado" }).click();
  await expect(editDialog).toHaveCount(0);
  await page
    .getByRole("alertdialog", { name: "Turno completado" })
    .getByRole("button", { name: "Ahora no" })
    .click();

  // Completed but no consulta yet — the agenda says so.
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Turnos completados", exact: true }).click();
  await expect(
    page
      .getByRole("button", { name: patientName })
      .getByRole("img", { name: "Falta registrar la consulta" }),
  ).toBeVisible();

  // Registering it afterwards from Consultas: a day with no turnos says
  // so, and switching the date to the turno's day offers it.
  await page.goto("/dashboard/consultas");
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  const dialog = page.getByRole("dialog", { name: "Nueva consulta" });
  await dialog.getByRole("combobox").first().click();
  await page.getByRole("option", { name: patientName }).click();
  await dialog.locator("#date").fill("2020-01-01");
  await expect(dialog.getByText("Sin turnos de este paciente ese día.")).toBeVisible();
  await dialog.locator("#date").fill(slot.dateStr);
  await dialog.locator("#appointmentLink").click();
  await page.getByRole("option", { name: /Arreglo de caries/ }).click();
  await dialog.getByText("Elegí un tratamiento").click();
  await page.getByRole("option", { name: "Obturación (caries)" }).click();
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(dialog).toHaveCount(0);

  await page.goto("/dashboard/turnos?estado=COMPLETED");
  await expect(
    page.getByRole("button", { name: patientName }).getByRole("img", { name: "Consulta registrada" }),
  ).toBeVisible();
});

test("Nuevo turno from the weekly header defaults to a date within the viewed week", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  await page.goto("/dashboard/turnos");
  // Jump two weeks ahead so "today" is never the default by coincidence.
  await page.getByRole("link", { name: "Semana siguiente" }).click();
  await page.getByRole("link", { name: "Semana siguiente" }).click();
  await page.waitForTimeout(300);

  const viewedWeekStart = new URL(page.url()).searchParams.get("week");
  expect(viewedWeekStart).toBeTruthy();

  await page.getByRole("button", { name: "Nuevo turno", exact: true }).click();
  await expect(page.locator("#date")).toHaveValue(viewedWeekStart!);
});

test("a cancelled turno no longer offers to cancel or complete it, only delete", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const patientName = `Paciente Estados E2E ${Date.now()}`;

  await page.goto("/dashboard/pacientes");
  await page.getByRole("button", { name: "Nuevo paciente" }).click();
  await page.fill("#name", patientName);
  await page.fill("#phone", "11 1010-1010");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(async () => {
    await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
    await expect(page.getByRole("link", { name: patientName })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });

  await page.goto("/dashboard/turnos");
  await page.getByRole("button", { name: "Nuevo turno", exact: true }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: patientName }).click();
  await saveAppointmentAvoidingConflicts(page, shuffledHalfHourSlotsInCurrentWeek());
  await expect(page.getByRole("button", { name: patientName })).toBeVisible();

  // While CONFIRMED, both status-change actions are offered.
  await page.getByRole("button", { name: patientName }).click();
  let dialog = page.getByRole("dialog", { name: "Editar turno" });
  await expect(dialog.getByRole("button", { name: "Marcar como completado" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancelar turno" })).toBeVisible();

  await dialog.getByRole("button", { name: "Cancelar turno" }).click();
  await expect(dialog).toHaveCount(0);

  // onSaved's router.refresh() is fire-and-forget — confirm the
  // cancellation actually landed (the bar disappears from the default
  // confirmed-only filter) before trusting the data is fresh.
  await expect(page.getByRole("button", { name: patientName })).toHaveCount(0);

  // Show cancelled turnos, then reopen it.
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Todos los turnos", exact: true }).click();
  await page.getByRole("button", { name: patientName }).click();
  dialog = page.getByRole("dialog", { name: "Editar turno" });
  await expect(dialog.getByRole("button", { name: "Marcar como completado" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Cancelar turno" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Eliminar" })).toBeVisible();
});
