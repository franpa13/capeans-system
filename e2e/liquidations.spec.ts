import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const EMAIL = process.env.E2E_TEST_EMAIL!.toLowerCase();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("a liquidación previews each consulta's commission, is saved, marked paid, and can't be repeated for the same period", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const { clinicId } = await prisma.clinicMember.findFirstOrThrow({ where: { email: EMAIL } });
  const professional = await prisma.professional.create({
    data: { clinicId, title: "Dra.", name: `Liquida E2E ${stamp}`, license: "MP 9", commissionPercent: 40 },
  });
  const implant = `Implante E2E ${stamp}`;
  const treatment = await prisma.clinicOption.create({
    data: { clinicId, category: "treatment", label: implant, commissionPercent: 50 },
  });
  const patient = await prisma.patient.create({
    data: { clinicId, name: `Paciente Liquida E2E ${stamp}`, phone: "1" },
  });
  // This month: 30.000 of an implant (50%) and 10.000 of a cleaning (her 40%).
  const now = new Date();
  for (const [name, amount] of [
    [implant, 30000],
    ["Limpieza", 10000],
  ] as const) {
    await prisma.consultation.create({
      data: {
        clinicId,
        patientId: patient.id,
        professionalId: professional.id,
        date: now,
        treatment: name,
        amountCharged: amount,
        amountPaid: amount,
        payments: { create: { clinicId, amount, method: "EFECTIVO", paidAt: now } },
      },
    });
  }
  const label = `Dra. ${professional.name}`;

  try {
    await page.goto("/sign-in");
    await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

    // Ingresos shows what she brought in this month.
    await page.goto("/dashboard/ingresos");
    await expect(
      page.getByRole("list", { name: "Cobrado por profesional" }).getByRole("listitem").filter({ hasText: label }),
    ).toContainText("40.000");

    await page.goto("/dashboard/liquidaciones");
    await page.getByRole("link", { name: "Nueva liquidación" }).click();
    await page.locator("#liquidationProfessional").click();
    await page.getByRole("option", { name: `${label} (40% de comisión)` }).click();
    await page.getByRole("radio", { name: /% por tratamiento/ }).check();
    await page.getByRole("button", { name: "Ver vista previa" }).click();

    const preview = page.locator("table");
    await expect(preview.getByRole("row").filter({ hasText: implant })).toContainText("15.000");
    await expect(preview.getByRole("row").filter({ hasText: implant })).toContainText("del tratamiento");
    await expect(preview.getByRole("row").filter({ hasText: "Limpieza" })).toContainText("4.000");
    await expect(preview.getByRole("row").filter({ hasText: "Total" })).toContainText("19.000");

    await page.getByRole("button", { name: "Guardar liquidación" }).click();
    await expect(page).toHaveURL(/\/dashboard\/liquidaciones\/[^/]+$/);
    await expect(page.getByRole("heading", { name: /^Liquidación LIQ-\d{5}$/ })).toBeVisible();
    await expect(page.getByText("Pendiente de pago")).toBeVisible();
    await page.getByRole("button", { name: "Marcar como pagada" }).click();
    await expect(page.getByText(/^Pagada el /)).toBeVisible();

    // Listed, and the same period can't be liquidated again.
    await page.goto("/dashboard/liquidaciones");
    await expect(page.getByRole("row").filter({ hasText: label })).toContainText("19.000");
    await page.getByRole("link", { name: "Nueva liquidación" }).click();
    await page.locator("#liquidationProfessional").click();
    await page.getByRole("option", { name: `${label} (40% de comisión)` }).click();
    await page.getByRole("button", { name: "Ver vista previa" }).click();
    await page.getByRole("button", { name: "Guardar liquidación" }).click();
    await expect(page.getByText(`Ya hay una liquidación de ${label} del`)).toBeVisible();
  } finally {
    await prisma.liquidation.deleteMany({ where: { professionalId: professional.id } });
    await prisma.consultation.deleteMany({ where: { patientId: patient.id } });
    await prisma.patient.delete({ where: { id: patient.id } });
    await prisma.clinicOption.delete({ where: { id: treatment.id } });
    await prisma.professional.delete({ where: { id: professional.id } });
  }
});
