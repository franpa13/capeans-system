import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

test("a user from clinic A cannot see a patient created by clinic B", async ({
  browser,
}) => {
  const clinicAContext = await browser.newContext();
  const clinicAPage = await clinicAContext.newPage();
  await clinicAPage.goto("/sign-in");
  await clerk.signIn({
    page: clinicAPage,
    emailAddress: process.env.E2E_CLINIC_A_EMAIL!,
  });

  const patientName = `Paciente Solo De Clinica A ${Date.now()}`;

  await clinicAPage.goto("/dashboard/pacientes");
  await clinicAPage.getByRole("button", { name: "Nuevo paciente" }).click();
  await clinicAPage.fill("#name", patientName);
  await clinicAPage.fill("#phone", "11 2222-2222");
  await clinicAPage.getByRole("button", { name: "Guardar" }).click();
  await expect(
    clinicAPage.getByRole("link", { name: patientName }),
  ).toBeVisible();

  const patientLink = clinicAPage.getByRole("link", { name: patientName });
  const patientHref = await patientLink.getAttribute("href");
  if (!patientHref) throw new Error("Patient link has no href");

  const clinicBContext = await browser.newContext();
  const clinicBPage = await clinicBContext.newPage();
  await clinicBPage.goto("/sign-in");
  await clerk.signIn({
    page: clinicBPage,
    emailAddress: process.env.E2E_CLINIC_B_EMAIL!,
  });

  await clinicBPage.goto("/dashboard/pacientes");
  await expect(
    clinicBPage.getByRole("heading", { name: "Pacientes" }),
  ).toBeVisible();
  await expect(clinicBPage.getByText(patientName)).not.toBeVisible();

  await clinicBPage.goto(patientHref);
  await expect(clinicBPage.getByText("No se encontró el paciente.")).toBeVisible();
  await expect(clinicBPage.getByText(patientName)).not.toBeVisible();

  await clinicAContext.close();
  await clinicBContext.close();
});
