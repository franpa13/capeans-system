import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";
import { PrismaClient, type MemberRole } from "@prisma/client";
import { createPatient } from "./patient-form";
import { openFichaSection } from "./ficha";

const prisma = new PrismaClient();
const EMAIL = process.env.E2E_TEST_EMAIL!.toLowerCase();

/** The E2E user's role in their consultorio, set straight in the DB — the
 * one way to see the app as recepción with a single test account. */
async function setMyRole(role: MemberRole) {
  await prisma.clinicMember.updateMany({ where: { email: EMAIL }, data: { role } });
}

test.afterAll(async () => {
  await setMyRole("ADMIN");
  await prisma.$disconnect();
});

test("the administrador invites someone with a role and can cancel it; the team lists them", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });
  await page.goto("/dashboard/configuracion?tab=team");

  const team = page.getByRole("list", { name: "Equipo" });
  await expect(team.getByText("Vos")).toBeVisible();
  await expect(team.getByRole("combobox").first()).toHaveText("Administrador");

  const email = `dentia+clerk_test_${Date.now()}@example.com`;
  await page.fill("#inviteEmail", email);
  await page.locator("#inviteRole").click();
  await page.getByRole("option", { name: "Recepción" }).click();
  await page.getByRole("button", { name: "Invitar" }).click();
  await expect(page.getByText(`Le enviamos la invitación a ${email}.`)).toBeVisible();

  const pending = page.getByRole("list", { name: "Invitaciones pendientes" });
  await expect(pending.getByRole("listitem").filter({ hasText: email })).toContainText("Recepción");
  await pending.getByRole("button", { name: `Cancelar la invitación a ${email}` }).click();
  await expect(page.getByRole("list", { name: "Invitaciones pendientes" })).toHaveCount(0);

  // The last administrador can't step down.
  await team.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Recepción" }).click();
  await expect(page.getByText("Tiene que quedar al menos un administrador")).toBeVisible();
});

test("recepción sees the agenda, patients' data and cobros, but not the historia clínica, ingresos or configuración", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  // As administrador: a patient with a charged consulta.
  const patientName = `Paciente Recepcion E2E ${Date.now()}`;
  await createPatient(page, patientName, "11 4444-5555", async () => {
    await page.getByRole("tab", { name: "Información médica" }).click();
    await page.fill("#allergies", "Penicilina");
    await page.fill("#medicalHistory", "Operado del corazón");
  });
  const patientUrl = page.url();
  const patientId = patientUrl.split("/").pop()!;
  const member = await prisma.clinicMember.findFirstOrThrow({ where: { email: EMAIL } });
  await prisma.consultation.create({
    data: {
      clinicId: member.clinicId,
      patientId,
      date: new Date(),
      treatment: "Limpieza",
      notes: "Nota clínica privada",
      amountCharged: 12000,
    },
  });

  await setMyRole("RECEPTION");
  try {
    await page.goto("/dashboard");
    const nav = page.getByRole("navigation").or(page.locator("[data-sidebar=sidebar]"));
    await expect(nav.getByRole("link", { name: "Turnos" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Ingresos" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Configuración" })).toHaveCount(0);

    await page.goto("/dashboard/ingresos");
    await expect(page.getByText("No tenés acceso a los ingresos.")).toBeVisible();
    await page.goto("/dashboard/configuracion");
    await expect(page.getByText("No tenés acceso a la configuración.")).toBeVisible();

    // The ficha: data, alerts and Pagos (with the debt) — no clinical tabs.
    await page.goto(patientUrl);
    await expect(page.getByRole("alert").filter({ hasText: "Penicilina" })).toBeVisible();
    const tabs = page.getByRole("tablist", { name: "Secciones del paciente" }).getByRole("tab");
    await expect(tabs).toHaveCount(2);
    await expect(tabs.filter({ hasText: "Pagos" })).toContainText("Debe");
    await expect(page.getByRole("button", { name: "Nueva consulta" })).toHaveCount(0);
    const html = await page.content();
    expect(html).not.toContain("Operado del corazón");

    // Consultas: no notes, no editing — but Cobrar.
    await page.goto(`/dashboard/consultas?paciente=${encodeURIComponent(patientName)}`);
    const row = page.locator("tbody tr", { hasText: patientName });
    await expect(row).toBeVisible();
    expect(await page.content()).not.toContain("Nota clínica privada");
    await expect(row.getByRole("button", { name: "Editar consulta" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Nueva consulta" })).toHaveCount(0);
    await row.getByRole("button", { name: "Cobrar" }).click();
    const charge = page.getByRole("dialog", { name: "Cobrar consulta" });
    await expect(charge.locator("#newPaymentAmount")).toHaveValue("12000");
    await charge.getByRole("button", { name: "Registrar pago" }).click();
    await expect(charge.getByText("Cobrado")).toBeVisible();
  } finally {
    await setMyRole("ADMIN");
  }

  // Back as administrador, clean up.
  await page.goto(patientUrl);
  await page.goto("/dashboard/pacientes");
  await page.getByPlaceholder("Buscar por nombre...").fill(patientName);
  await page.getByRole("button", { name: `Acciones para ${patientName}` }).click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
});
