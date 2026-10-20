import { test, expect, type Page } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** A day's half-hour slots in random order — earlier runs leave turnos
 * behind, so the first free one is used (same idea as appointments.spec). */
function shuffledSlotsOn(day: Date) {
  const dateStr = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
  const slots = [0, 30].flatMap((minute) =>
    Array.from({ length: 24 }, (_, hour) => ({ dateStr, timeStr: `${pad(hour)}:${pad(minute)}` })),
  );
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  return slots;
}

function dateStrOf(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Half-hour marks from 1h to 23h from now, in random order — every one
 * of them falls inside the "próximas 24 hs" reminder window. */
function shuffledSlotsInNext24h() {
  const start = new Date();
  start.setMinutes(start.getMinutes() < 30 ? 30 : 60, 0, 0);
  start.setHours(start.getHours() + 1);
  const slots = Array.from({ length: 44 }, (_, i) => {
    const d = new Date(start.getTime() + i * 30 * 60_000);
    return { dateStr: dateStrOf(d), timeStr: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  });
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  return slots;
}

async function bookTurno(page: Page, patientName: string, day: Date) {
  return (await bookTurnoIn(page, patientName, shuffledSlotsOn(day))).timeStr;
}

async function bookTurnoIn(
  page: Page,
  patientName: string,
  candidates: { dateStr: string; timeStr: string }[],
) {
  await page.goto("/dashboard/turnos?view=week");
  await page.getByRole("button", { name: "Nuevo turno", exact: true }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: patientName }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo turno" });
  for (const { dateStr, timeStr } of candidates) {
    await page.fill("#date", dateStr);
    await page.fill("#time", timeStr);
    await page.getByRole("button", { name: "Guardar" }).click();
    const outcome = await Promise.race([
      dialog.waitFor({ state: "hidden", timeout: 3000 }).then(() => "success" as const),
      page
        .getByText("Ya hay un turno agendado en ese horario")
        .waitFor({ state: "visible", timeout: 3000 })
        .then(() => "conflict" as const),
    ]).catch(() => "unknown" as const);
    if (outcome === "success") return { dateStr, timeStr };
  }
  throw new Error("No free slot left among the candidates");
}

async function createPatient(page: Page, name: string, phone: string) {
  await page.goto("/dashboard/pacientes");
  await page.getByRole("button", { name: "Nuevo paciente" }).click();
  await page.fill("#name", name);
  await page.fill("#phone", phone);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo paciente" })).toHaveCount(0);
}

test("Inicio shows today's turnos, lets a consulta be registered from there, and lists debts and low stock", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const patientName = `Paciente Hoy E2E ${Date.now()}`;
  await createPatient(page, patientName, "11 5555-6666");
  const time = await bookTurno(page, patientName, new Date());

  const supplyName = `Insumo Hoy E2E ${Date.now()}`;
  await page.goto("/dashboard/stock");
  await page.getByRole("button", { name: "Nuevo insumo" }).click();
  const newSupply = page.getByRole("dialog", { name: "Nuevo insumo" });
  await newSupply.getByLabel("Nombre").fill(supplyName);
  await newSupply.getByLabel("Unidad").fill("unidad");
  await newSupply.getByLabel("Stock inicial").fill("0");
  await newSupply.getByRole("button", { name: "Guardar" }).click();
  await expect(newSupply).toHaveCount(0);

  // Today's turno is listed with its time, and has nothing registered yet.
  await page.goto("/dashboard");
  const today = page.getByRole("region", { name: "Turnos de hoy" });
  const turno = today.getByRole("listitem").filter({ hasText: patientName });
  await expect(turno.getByText(time, { exact: true })).toBeVisible();

  // Registering the consulta right from Inicio links it to the turno.
  await turno.getByRole("button", { name: "Registrar consulta" }).click();
  const consulta = page.getByRole("dialog", { name: "Nueva consulta" });
  await expect(consulta.getByText(patientName)).toBeVisible();
  await consulta.getByText("Elegí un tratamiento").click();
  await page.getByRole("option", { name: "Limpieza" }).click();
  // Large enough to rank first: "Le deben" shows the top 5, and the shared
  // E2E clinic carries debts left over from other tests.
  await consulta.locator("#amountCharged").fill("99999999");
  await consulta.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(consulta).toHaveCount(0);
  await expect(turno.getByText("Consulta registrada")).toBeVisible();
  await expect(turno.getByRole("button", { name: "Registrar consulta" })).toHaveCount(0);

  // The unpaid consulta shows up under "Le deben", linking to the patient.
  const debts = page.getByRole("region", { name: "Le deben" });
  const debt = debts.getByRole("listitem").filter({ hasText: patientName });
  await expect(debt.getByText("99.999.999", { exact: false })).toBeVisible();

  // The insumo at 0 shows up under "Stock bajo" as "Sin stock".
  const stock = page.getByRole("region", { name: "Stock bajo" });
  await expect(
    stock.getByRole("listitem").filter({ hasText: supplyName }).getByText("Sin stock"),
  ).toBeVisible();

  await debt.getByRole("link", { name: patientName }).click();
  await expect(page.getByRole("heading", { name: patientName })).toBeVisible();

  // Cleanup: the consulta (so the insumo-free patient stops owing), then the insumo.
  await page.goto("/dashboard/consultas");
  await expect(async () => {
    await page.locator("#filter-patient").fill(patientName);
    await expect(page.locator("tbody").getByText(patientName)).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
  await page
    .locator("tbody tr", { hasText: patientName })
    .getByRole("button", { name: "Eliminar consulta" })
    .click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).last().click();
  await expect(page.locator("tbody").getByText(patientName)).toHaveCount(0);

  await page.goto("/dashboard/stock");
  await page.getByPlaceholder("Buscar...").fill(supplyName);
  await page.getByRole("button", { name: `Acciones para ${supplyName}` }).click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.locator("tbody").getByText(supplyName)).toHaveCount(0);
});

test("turnos in the next 24 hours get a one-tap WhatsApp reminder that's marked as sent", async ({
  page,
  context,
}) => {
  // Never actually reach WhatsApp from a test run.
  await context.route("https://wa.me/**", (route) => route.fulfill({ body: "WhatsApp" }));
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const patientName = `Recordatorio E2E ${Date.now()}`;
  await createPatient(page, patientName, "011 15 3333-4444");
  const { dateStr, timeStr: time } = await bookTurnoIn(page, patientName, shuffledSlotsInNext24h());
  const day = dateStr === dateStrOf(new Date()) ? "hoy" : "mañana";

  await page.goto("/dashboard");
  const reminders = page.getByRole("region", { name: "Recordatorios: próximas 24 hs" });
  const row = reminders.getByRole("listitem").filter({ hasText: patientName });
  const link = row.getByRole("link", { name: "Recordar por WhatsApp" });
  await expect(row.getByText(day === "hoy" ? "Hoy" : "Mañana", { exact: true })).toBeVisible();

  // The chat opens on the patient's number, normalized to the
  // international format, with the reminder already written.
  const href = (await link.getAttribute("href"))!;
  expect(href.startsWith("https://wa.me/5491133334444?text=")).toBe(true);
  const message = decodeURIComponent(href.split("?text=")[1]);
  expect(message).toContain("Hola Recordatorio,");
  expect(message).toContain(`tu turno ${day} a las ${time}`);

  const popup = context.waitForEvent("page");
  await link.click();
  await (await popup).close();

  await expect(row.getByText("Recordatorio enviado")).toBeVisible();
  await expect(row.getByRole("link", { name: "Volver a enviar" })).toBeVisible();
});
