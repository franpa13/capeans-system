import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";
import { createPatient } from "./patient-form";

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

  await createPatient(clinicAPage, patientName, "11 2222-2222");
  await clinicAPage.goto("/dashboard/pacientes");
  // With pagination, a new patient isn't necessarily on the first page
  // (the list sorts alphabetically) — search for it like a real user would.
  // The server action's post-mutation refresh can land after the fill and
  // wipe the typed search text, so retry the fill until it sticks instead
  // of gambling on a fixed delay.
  await expect(async () => {
    await clinicAPage.getByPlaceholder("Buscar por nombre...").fill(patientName);
    await expect(clinicAPage.getByRole("link", { name: patientName })).toBeVisible({
      timeout: 1000,
    });
  }).toPass({ timeout: 10000 });

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
