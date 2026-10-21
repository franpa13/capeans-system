import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";
import { PrismaClient } from "@prisma/client";
import { createPatient } from "./patient-form";
import { openFichaSection } from "./ficha";

const prisma = new PrismaClient();
const EMAIL = process.env.E2E_TEST_EMAIL!.toLowerCase();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("each dentist has their own agenda: two can attend at once, the agenda filters by professional, and a linked dentist is the default", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const stamp = Date.now();
  const member = await prisma.clinicMember.findFirstOrThrow({ where: { email: EMAIL } });
  const clinicId = member.clinicId;
  const moretti = await prisma.professional.create({
    data: { clinicId, title: "Dra.", name: `Valeria Moretti${stamp}`, license: "MP 1" },
  });
  const benitez = await prisma.professional.create({
    data: { clinicId, title: "Dr.", name: `Andrés Benítez${stamp}`, license: "MP 2" },
  });
  const short = (p: { title: string; name: string }) => `${p.title} ${p.name.split(" ").pop()}`;
  // A far-off Monday at 10:00, clear of other tests' turnos.
  const day = new Date(2027, 2, 15 + (stamp % 20) * 7);
  const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;

  try {
    await page.goto("/sign-in");
    await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

    // Equipo: the signed-in administrador is Dra. Moretti.
    await page.goto("/dashboard/configuracion?tab=team");
    await page.getByRole("combobox", { name: /^Perfil profesional de / }).click();
    await page.getByRole("option", { name: `Dra. ${moretti.name}` }).click();
    await expect(page.getByRole("combobox", { name: /^Perfil profesional de / })).toHaveText(`Dra. ${moretti.name}`);

    const patientName = `Paciente Agenda E2E ${stamp}`;
    await createPatient(page, patientName, "11 6666-7777");

    // A turno for her (the default), and one at the same time for Benítez.
    for (const professional of [null, benitez]) {
      await page.goto(`/dashboard/turnos?view=week&week=${dateStr}`);
      await page.getByRole("button", { name: "Nuevo turno", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Nuevo turno" });
      await dialog.getByRole("combobox").first().click();
      await page.getByRole("option", { name: patientName }).click();
      if (professional) {
        await dialog.locator("#appointmentProfessional").click();
        await page.getByRole("option", { name: `Dr. ${professional.name}` }).click();
      } else {
        await expect(dialog.locator("#appointmentProfessional")).toHaveText(`Dra. ${moretti.name}`);
      }
      await page.fill("#date", dateStr);
      await page.fill("#time", "10:00");
      await dialog.getByRole("button", { name: "Guardar" }).click();
      await expect(dialog).toHaveCount(0);
    }
    // But not two at once for the same dentist.
    await page.getByRole("button", { name: "Nuevo turno", exact: true }).click();
    const third = page.getByRole("dialog", { name: "Nuevo turno" });
    await third.getByRole("combobox").first().click();
    await page.getByRole("option", { name: patientName }).click();
    await page.fill("#date", dateStr);
    await page.fill("#time", "10:00");
    await third.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Ya hay un turno agendado en ese horario")).toBeVisible();
    await page.keyboard.press("Escape");

    // The week shows both, each with its dentist; the filter narrows to one.
    const turnos = page.getByRole("button", { name: patientName });
    await expect(turnos).toHaveCount(2);
    await expect(turnos.filter({ hasText: short(moretti) })).toHaveCount(1);
    await expect(turnos.filter({ hasText: short(benitez) })).toHaveCount(1);
    await page.getByRole("combobox", { name: "Profesional" }).click();
    await page.getByRole("option", { name: `Dr. ${benitez.name}` }).click();
    await expect(page).toHaveURL(new RegExp(`prof=${benitez.id}`));
    await expect(turnos).toHaveCount(1);
    await expect(turnos).toContainText(short(benitez));
    // Moving weeks keeps the filter.
    await page.getByRole("link", { name: "Semana siguiente" }).click();
    await expect(page).toHaveURL(new RegExp(`prof=${benitez.id}`));

    // Her consulta: Atendió is her by default.
    await page.goto("/dashboard/pacientes");
    await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
    await page.getByRole("link", { name: patientName }).first().click();
    await page.getByRole("button", { name: "Nueva consulta" }).click();
    await expect(page.getByRole("dialog", { name: "Nueva consulta" }).locator("#consultationProfessional")).toHaveText(
      `Dra. ${moretti.name}`,
    );
    await page.keyboard.press("Escape");
    await openFichaSection(page, "Resumen");
  } finally {
    await prisma.clinicMember.update({ where: { id: member.id }, data: { professionalId: null } });
    await prisma.appointment.deleteMany({ where: { professionalId: { in: [moretti.id, benitez.id] } } });
    await prisma.professional.deleteMany({ where: { id: { in: [moretti.id, benitez.id] } } });
  }
});
