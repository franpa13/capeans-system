import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";
import { addClinicOption, searchClinicOption } from "./clinic-options";

test("the treatment catalog counts by especialidad, filters, and feeds consultas and turnos", async ({
  page,
}) => {
  // Configuración, Consultas and Turnos in one go.
  test.setTimeout(90_000);
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: process.env.E2E_TEST_EMAIL! });

  const stamp = Date.now();
  const active = `Catálogo Activo E2E ${stamp}`;
  const inactive = `Catálogo Inactivo E2E ${stamp}`;

  await page.goto("/dashboard/configuracion");
  await page.getByRole("tab", { name: "Tratamientos" }).click();

  const chips = page.getByRole("group", { name: "Especialidades" });
  const endodoncia = chips.getByRole("button", { name: /^Endodoncia/ });
  const before = Number(await endodoncia.locator("span").innerText());

  try {
    // A full tratamiento: code, especialidad, both prices, and a duration.
    await page.getByRole("button", { name: "Nuevo tratamiento" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo tratamiento" });
    await dialog.getByLabel("Nombre").fill(active);
    await dialog.getByLabel("Código").fill(`E2E-${stamp}`);
    await dialog.getByLabel("Especialidad").click();
    await page.getByRole("option", { name: "Endodoncia", exact: true }).click();
    await dialog.getByLabel("Precio de lista").fill("50000");
    await dialog.getByLabel("Precio en efectivo").fill("45000");
    await dialog.getByLabel("Duración (min)").fill("40");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog).toHaveCount(0);

    await expect(endodoncia.locator("span")).toHaveText(String(before + 1));

    // An inactive one, which consultas and turnos must not offer.
    await addClinicOption(page, "tratamiento", inactive, "1000");
    await page.getByRole("button", { name: `Editar ${inactive}` }).click();
    const edit = page.getByRole("dialog", { name: "Editar tratamiento" });
    await edit.getByLabel("Activo", { exact: false }).uncheck();
    await edit.getByRole("button", { name: "Guardar" }).click();
    await expect(edit).toHaveCount(0);

    // Filters: especialidad chip, then Activos / Inactivos.
    await searchClinicOption(page, "tratamiento", `E2E ${stamp}`);
    await endodoncia.click();
    await expect(page.getByText(active, { exact: true })).toBeVisible();
    await expect(page.getByText(inactive, { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Limpiar" }).click();

    const status = page.getByRole("group", { name: "Estado" });
    await status.getByRole("button", { name: /^Inactivos/ }).click();
    await expect(page.getByText(inactive, { exact: true })).toBeVisible();
    await expect(page.getByText(active, { exact: true })).toHaveCount(0);
    await status.getByRole("button", { name: /^Activos/ }).click();
    await expect(page.getByText(active, { exact: true })).toBeVisible();
    await expect(page.getByText(inactive, { exact: true })).toHaveCount(0);

    // Nueva consulta: only the active one, and its cash price in one tap.
    await page.goto("/dashboard/consultas");
    await page.getByRole("button", { name: "Nueva consulta" }).click();
    await page.getByText("Elegí un tratamiento").click();
    await expect(page.getByRole("option", { name: inactive })).toHaveCount(0);
    await page.getByRole("option", { name: active }).click();
    await expect(page.locator("#amountCharged")).toHaveValue("50000");
    await page.getByRole("button", { name: "Usar precio en efectivo" }).click();
    await expect(page.locator("#amountCharged")).toHaveValue("45000");
    await page.keyboard.press("Escape");

    // Nuevo turno: choosing the tratamiento as motivo sizes the turno.
    await page.goto("/dashboard/turnos");
    await page.getByRole("button", { name: "Nuevo turno", exact: true }).click();
    const turno = page.getByRole("dialog", { name: "Nuevo turno" });
    await turno.locator("#reason").fill(active);
    await expect(turno.locator("#durationMinutes")).toHaveText("40 min");
  } finally {
    await page.goto("/dashboard/configuracion");
    await page.getByRole("tab", { name: "Tratamientos" }).click();
    for (const label of [active, inactive]) {
      await searchClinicOption(page, "tratamiento", label);
      const remove = page.getByRole("button", { name: `Eliminar ${label}` });
      if ((await remove.count()) === 0) continue;
      await remove.click();
      await page.getByRole("button", { name: "Eliminar", exact: true }).click();
      await expect(page.getByText(label, { exact: true })).toHaveCount(0);
    }
  }
});
