import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPatient } from "@/features/clinic/data/patients";
import { createConsultation } from "@/features/clinic/data/consultations";
import {
  createSupply,
  deleteSupply,
  getSupplies,
  restockSupply,
  updateSupply,
} from "@/features/clinic/data/supplies";

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
  await prisma.consultationSupply.deleteMany({});
  await prisma.consultation.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.supply.deleteMany({});
  await prisma.clinic.deleteMany({});
});

describe("supplies data layer", () => {
  it("creates a supply with the given fields", async () => {
    const supply = await createSupply(clinicA.id, {
      name: "Gomillas de ortodoncia",
      unit: "unidad",
      price: 50,
      quantity: 200,
      lowStockAt: 20,
    });
    expect(supply.clinicId).toBe(clinicA.id);
    expect(supply.name).toBe("Gomillas de ortodoncia");
    expect(supply.unit).toBe("unidad");
    expect(supply.price).toBe(50);
    expect(supply.quantity).toBe(200);
    expect(supply.lowStockAt).toBe(20);
  });

  it("defaults quantity to 0 and price/lowStockAt to null when not given", async () => {
    const supply = await createSupply(clinicA.id, { name: "Anestesia", unit: "ampolla" });
    expect(supply.quantity).toBe(0);
    expect(supply.price).toBeNull();
    expect(supply.lowStockAt).toBeNull();
  });

  it("refuses an empty name", async () => {
    await expect(createSupply(clinicA.id, { name: "  ", unit: "unidad" })).rejects.toThrow(
      "El nombre no puede estar vacío",
    );
  });

  it("refuses an empty unit", async () => {
    await expect(createSupply(clinicA.id, { name: "Guantes", unit: "  " })).rejects.toThrow(
      "La unidad no puede estar vacía",
    );
  });

  it("refuses a duplicate name within the same clinic", async () => {
    await createSupply(clinicA.id, { name: "Guantes", unit: "caja" });
    await expect(createSupply(clinicA.id, { name: "Guantes", unit: "caja" })).rejects.toThrow(
      "Ya existe un insumo con ese nombre",
    );
  });

  it("allows the same name in different clinics", async () => {
    await createSupply(clinicA.id, { name: "Guantes", unit: "caja" });
    await expect(createSupply(clinicB.id, { name: "Guantes", unit: "caja" })).resolves.toBeTruthy();
  });

  it("refuses a negative price", async () => {
    await expect(
      createSupply(clinicA.id, { name: "Composite", unit: "ml", price: -10 }),
    ).rejects.toThrow("El precio no puede ser negativo");
  });

  it("refuses a non-integer price", async () => {
    await expect(
      createSupply(clinicA.id, { name: "Composite", unit: "ml", price: 10.5 }),
    ).rejects.toThrow("El precio tiene que ser un número entero");
  });

  it("refuses a negative initial quantity", async () => {
    await expect(
      createSupply(clinicA.id, { name: "Composite", unit: "ml", quantity: -5 }),
    ).rejects.toThrow("El stock inicial no puede ser negativo");
  });

  it("refuses a negative lowStockAt", async () => {
    await expect(
      createSupply(clinicA.id, { name: "Composite", unit: "ml", lowStockAt: -1 }),
    ).rejects.toThrow("El umbral no puede ser negativo");
  });

  it("does not return a clinic A supply when queried with clinic B's id", async () => {
    await createSupply(clinicA.id, { name: "Solo A", unit: "unidad" });
    expect(await getSupplies(clinicB.id)).toHaveLength(0);
  });

  it("updates a supply's name, unit, price, and lowStockAt without touching quantity", async () => {
    const supply = await createSupply(clinicA.id, {
      name: "Guantes",
      unit: "caja",
      price: 500,
      quantity: 30,
    });
    const updated = await updateSupply(clinicA.id, supply.id, {
      name: "Guantes de nitrilo",
      unit: "caja",
      price: 600,
      lowStockAt: 5,
    });
    expect(updated.name).toBe("Guantes de nitrilo");
    expect(updated.price).toBe(600);
    expect(updated.lowStockAt).toBe(5);
    expect(updated.quantity).toBe(30);
  });

  it("refuses updating to a duplicate name within the same clinic", async () => {
    await createSupply(clinicA.id, { name: "Guantes", unit: "caja" });
    const other = await createSupply(clinicA.id, { name: "Mascarillas", unit: "caja" });
    await expect(
      updateSupply(clinicA.id, other.id, { name: "Guantes", unit: "caja" }),
    ).rejects.toThrow("Ya existe un insumo con ese nombre");
  });

  it("refuses updating a supply belonging to another clinic", async () => {
    const supply = await createSupply(clinicB.id, { name: "De B", unit: "unidad" });
    await expect(
      updateSupply(clinicA.id, supply.id, { name: "Robado", unit: "unidad" }),
    ).rejects.toThrow("Supply not found for this clinic");
  });

  it("restocks by adding to the current quantity", async () => {
    const supply = await createSupply(clinicA.id, { name: "Guantes", unit: "caja", quantity: 10 });
    const restocked = await restockSupply(clinicA.id, supply.id, 15);
    expect(restocked.quantity).toBe(25);
  });

  it("refuses restocking with a zero or negative amount", async () => {
    const supply = await createSupply(clinicA.id, { name: "Guantes", unit: "caja" });
    await expect(restockSupply(clinicA.id, supply.id, 0)).rejects.toThrow(
      "La cantidad a reponer tiene que ser mayor a 0",
    );
    await expect(restockSupply(clinicA.id, supply.id, -5)).rejects.toThrow(
      "La cantidad a reponer tiene que ser mayor a 0",
    );
  });

  it("refuses restocking with a non-integer amount", async () => {
    const supply = await createSupply(clinicA.id, { name: "Guantes", unit: "caja" });
    await expect(restockSupply(clinicA.id, supply.id, 1.5)).rejects.toThrow(
      "La cantidad a reponer tiene que ser un número entero",
    );
  });

  it("refuses restocking a supply belonging to another clinic", async () => {
    const supply = await createSupply(clinicB.id, { name: "De B", unit: "unidad", quantity: 10 });
    await expect(restockSupply(clinicA.id, supply.id, 5)).rejects.toThrow(
      "Supply not found for this clinic",
    );
  });

  it("deletes a supply that has never been used", async () => {
    const supply = await createSupply(clinicA.id, { name: "Guantes", unit: "caja" });
    await deleteSupply(clinicA.id, supply.id);
    expect(await getSupplies(clinicA.id)).toHaveLength(0);
  });

  it("refuses deleting a supply that has at least one consultation using it", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const supply = await createSupply(clinicA.id, { name: "Gomillas", unit: "unidad", quantity: 100 });
    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Ortodoncia",
      supplies: [{ supplyId: supply.id, quantityUsed: 5 }],
    });
    await expect(deleteSupply(clinicA.id, supply.id)).rejects.toThrow(
      "No se puede eliminar un insumo que ya fue usado en alguna consulta",
    );
  });
});
