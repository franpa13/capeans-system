import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createClinicOption,
  deleteClinicOption,
  getClinicOptions,
  seedDefaultClinicOptions,
  updateClinicOption,
} from "@/features/clinic/data/clinic-options";

let clinicA: { id: string };
let clinicB: { id: string };

beforeEach(async () => {
  clinicA = await prisma.clinic.create({
    data: { clerkOrgId: `org_a_${Date.now()}`, name: "Clínica A" },
  });
  clinicB = await prisma.clinic.create({
    data: { clerkOrgId: `org_b_${Date.now()}`, name: "Clínica B" },
  });
});

afterEach(async () => {
  await prisma.clinicOption.deleteMany({});
  await prisma.clinic.deleteMany({});
});

describe("clinic options data layer", () => {
  it("seeds default insurance and treatment options for a new clinic", async () => {
    await seedDefaultClinicOptions(clinicA.id);

    const insurance = await getClinicOptions(clinicA.id, "insurance");
    const treatment = await getClinicOptions(clinicA.id, "treatment");
    expect(insurance.length).toBeGreaterThan(0);
    expect(treatment.length).toBeGreaterThan(0);
    expect(insurance.map((o) => o.label)).toContain("OSDE");
    expect(treatment.map((o) => o.label)).toContain("Limpieza");
  });

  it("does not reseed a clinic that already has options", async () => {
    await seedDefaultClinicOptions(clinicA.id);
    await createClinicOption(clinicA.id, "insurance", "Mi Obra Social Custom");
    await seedDefaultClinicOptions(clinicA.id);

    const insurance = await getClinicOptions(clinicA.id, "insurance");
    expect(insurance.filter((o) => o.label === "Mi Obra Social Custom")).toHaveLength(1);
  });

  it("creates an option scoped to the given clinic and category", async () => {
    const option = await createClinicOption(clinicA.id, "insurance", "Nueva Obra Social");
    expect(option.clinicId).toBe(clinicA.id);
    expect(option.category).toBe("insurance");
    expect(option.label).toBe("Nueva Obra Social");
  });

  it("creates a treatment option with a price", async () => {
    const option = await createClinicOption(clinicA.id, "treatment", "Limpieza", 15000);
    expect(option.price).toBe(15000);
  });

  it("creates an option with no price when none is given", async () => {
    const option = await createClinicOption(clinicA.id, "treatment", "Consulta");
    expect(option.price).toBeNull();
  });

  it("refuses a negative price on create", async () => {
    await expect(
      createClinicOption(clinicA.id, "treatment", "Inválido", -100),
    ).rejects.toThrow("El precio no puede ser negativo");
  });

  it("refuses a non-integer price on create", async () => {
    await expect(
      createClinicOption(clinicA.id, "treatment", "Inválido2", 15.5),
    ).rejects.toThrow("El precio tiene que ser un número entero");
  });

  it("refuses a NaN price on create", async () => {
    await expect(
      createClinicOption(clinicA.id, "treatment", "Inválido3", NaN),
    ).rejects.toThrow("El precio tiene que ser un número entero");
  });

  it("updates an option's price", async () => {
    const option = await createClinicOption(clinicA.id, "treatment", "Endodoncia", 20000);
    const updated = await updateClinicOption(clinicA.id, option.id, "Endodoncia", 25000);
    expect(updated.price).toBe(25000);
  });

  it("clears a price back to null when updated with none", async () => {
    const option = await createClinicOption(clinicA.id, "treatment", "Ortodoncia", 30000);
    const updated = await updateClinicOption(clinicA.id, option.id, "Ortodoncia");
    expect(updated.price).toBeNull();
  });

  it("refuses a negative price on update", async () => {
    const option = await createClinicOption(clinicA.id, "treatment", "Corona", 10000);
    await expect(
      updateClinicOption(clinicA.id, option.id, "Corona", -5),
    ).rejects.toThrow("El precio no puede ser negativo");
  });

  it("ignores a price given for an insurance option on create", async () => {
    const option = await createClinicOption(clinicA.id, "insurance", "OSDE Custom", 15000);
    expect(option.price).toBeNull();
  });

  it("ignores a price given for an insurance option on update", async () => {
    const option = await createClinicOption(clinicA.id, "insurance", "OSDE Custom 2");
    const updated = await updateClinicOption(clinicA.id, option.id, "OSDE Custom 2", 15000);
    expect(updated.price).toBeNull();
  });

  it("does not return a clinic A option when queried with clinic B's id", async () => {
    await createClinicOption(clinicA.id, "insurance", "Solo A");
    const result = await getClinicOptions(clinicB.id, "insurance");
    expect(result).toHaveLength(0);
  });

  it("refuses to create a duplicate label within the same clinic and category", async () => {
    await createClinicOption(clinicA.id, "treatment", "Blanqueamiento");
    await expect(
      createClinicOption(clinicA.id, "treatment", "Blanqueamiento"),
    ).rejects.toThrow("Ya existe una opción con ese nombre");
  });

  it("allows the same label in different clinics", async () => {
    await createClinicOption(clinicA.id, "treatment", "Blanqueamiento");
    const option = await createClinicOption(clinicB.id, "treatment", "Blanqueamiento");
    expect(option.clinicId).toBe(clinicB.id);
  });

  it("allows the same label in different categories of the same clinic", async () => {
    await createClinicOption(clinicA.id, "insurance", "Varios");
    const option = await createClinicOption(clinicA.id, "treatment", "Varios");
    expect(option.category).toBe("treatment");
  });

  it("renames an option", async () => {
    const option = await createClinicOption(clinicA.id, "insurance", "Nombre Viejo");
    const updated = await updateClinicOption(clinicA.id, option.id, "Nombre Nuevo");
    expect(updated.label).toBe("Nombre Nuevo");
  });

  it("refuses to rename into a label that already exists in the same category", async () => {
    await createClinicOption(clinicA.id, "insurance", "Existente");
    const option = await createClinicOption(clinicA.id, "insurance", "A renombrar");
    await expect(
      updateClinicOption(clinicA.id, option.id, "Existente"),
    ).rejects.toThrow("Ya existe una opción con ese nombre");
  });

  it("refuses to update an option belonging to another clinic", async () => {
    const option = await createClinicOption(clinicA.id, "insurance", "De A");
    await expect(
      updateClinicOption(clinicB.id, option.id, "Hackeado"),
    ).rejects.toThrow("Option not found for this clinic");
  });

  it("refuses to delete an option belonging to another clinic", async () => {
    const option = await createClinicOption(clinicA.id, "insurance", "De A");
    await deleteClinicOption(clinicB.id, option.id);
    const stillThere = await getClinicOptions(clinicA.id, "insurance");
    expect(stillThere.map((o) => o.id)).toContain(option.id);
  });

  it("deletes an option without touching patients/consultations referencing the old label by text", async () => {
    const option = await createClinicOption(clinicA.id, "insurance", "Temporal");
    const patient = await prisma.patient.create({
      data: { clinicId: clinicA.id, name: "Paciente", phone: "111", insurance: "Temporal" },
    });

    await deleteClinicOption(clinicA.id, option.id);

    const reloaded = await prisma.patient.findUnique({ where: { id: patient.id } });
    expect(reloaded?.insurance).toBe("Temporal");
  });
});
