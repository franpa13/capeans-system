import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// A fixed slot would collide with leftover appointments from previous
// runs — pick a random day (Mon..Sat, so it's within the calendar's
// default current-week view) and hour each run, same spirit as the
// timestamped patient names used elsewhere in these specs, but with
// enough spread that two runs seconds apart don't collide either.
function randomSlotInCurrentWeek() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(monday.getDate() + diffToMonday);

  const date = new Date(monday);
  date.setDate(date.getDate() + Math.floor(Math.random() * 6)); // Mon..Sat
  const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timeStr = `${pad(Math.floor(Math.random() * 24))}:00`;
  return { dateStr, timeStr };
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
  const { dateStr: date, timeStr: time } = randomSlotInCurrentWeek();

  await page.goto("/dashboard/pacientes");
  await page.getByRole("button", { name: "Nuevo paciente" }).click();
  await page.fill("#name", patientName);
  await page.fill("#phone", "11 3333-3333");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("link", { name: patientName })).toBeVisible();

  await page.goto("/dashboard/turnos");
  await page.getByRole("button", { name: "Nuevo turno", exact: true }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: patientName }).click();
  await page.fill("#date", date);
  await page.fill("#time", time);
  await page.getByRole("button", { name: "Guardar" }).click();

  await expect(page.getByRole("button", { name: patientName })).toBeVisible();

  // Try to double-book the exact same slot with the same patient.
  await page.getByRole("button", { name: "Nuevo turno", exact: true }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: patientName }).click();
  await page.fill("#date", date);
  await page.fill("#time", time);
  await page.getByRole("button", { name: "Guardar" }).click();

  await expect(page.getByText("Ya hay un turno agendado en ese horario")).toBeVisible();
});
