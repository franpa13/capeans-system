import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPatient } from "@/features/clinic/data/patients";
import { createProfessional, updateProfessional } from "@/features/clinic/data/professionals";
import { createTreatment } from "@/features/clinic/data/clinic-options";
import { createConsultation } from "@/features/clinic/data/consultations";
import { addPayment } from "@/features/clinic/data/payments";
import {
  createLiquidation,
  deleteLiquidation,
  getLiquidation,
  getLiquidationPreview,
  getLiquidations,
  setLiquidationPaid,
} from "@/features/clinic/data/liquidations";

let clinicA: { id: string };
let clinicB: { id: string };
let patientId: string;
let moretti: string;
let benitez: string;

beforeEach(async () => {
  clinicA = await prisma.clinic.create({ data: { clerkOrgId: `org_a_${Date.now()}`, name: "Clínica A" } });
  clinicB = await prisma.clinic.create({ data: { clerkOrgId: `org_b_${Date.now()}`, name: "Clínica B" } });
  patientId = (await createPatient(clinicA.id, { name: "Ana Gómez", phone: "1" })).id;
  moretti = (
    await createProfessional(clinicA.id, { title: "Dra.", name: "Valeria Moretti", license: "MP 1", commissionPercent: 40 })
  ).id;
  benitez = (await createProfessional(clinicA.id, { title: "Dr.", name: "Andrés Benítez", license: "MP 2" })).id;
  await createTreatment(clinicA.id, { label: "Implante", price: 100000, commissionPercent: 50 });
});

afterEach(async () => {
  await prisma.liquidation.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.consultation.deleteMany({});
  await prisma.clinicOption.deleteMany({});
  await prisma.professional.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.clinic.deleteMany({});
});

/** A consulta by `professionalId` with what was paid on each date. */
async function consulta(professionalId: string, treatment: string, payments: [number, Date][]) {
  const c = await createConsultation(clinicA.id, {
    patientId,
    professionalId,
    date: payments[0][1],
    treatment,
    amountCharged: 200000,
  });
  for (const [amount, paidAt] of payments) {
    await addPayment(clinicA.id, c.id, { amount, method: "EFECTIVO", paidAt });
  }
  return c;
}

const oct = (day: number) => new Date(2026, 9, day, 12, 0);
const period = { from: "2026-10-01", to: "2026-10-31" };

describe("professional commission settings", () => {
  it("keeps the % between 0 and 100", async () => {
    await expect(
      createProfessional(clinicA.id, { title: "Dr.", name: "X", license: "1", commissionPercent: 120 }),
    ).rejects.toThrow("La comisión tiene que ser un número entero entre 0 y 100");
    await expect(createTreatment(clinicA.id, { label: "Y", commissionPercent: -1 })).rejects.toThrow(
      "La comisión tiene que ser un número entero entre 0 y 100",
    );
  });
});

describe("liquidation preview", () => {
  it("adds up what was collected in the period for the professional's consultas, per consulta", async () => {
    await consulta(moretti, "Limpieza", [
      [10000, oct(5)],
      [5000, oct(20)],
    ]);
    await consulta(moretti, "Implante", [[40000, oct(10)]]);
    await consulta(moretti, "Limpieza", [[9999, new Date(2026, 10, 2)]]); // November: out
    await consulta(benitez, "Limpieza", [[7000, oct(6)]]); // someone else's

    const byProfessional = await getLiquidationPreview(clinicA.id, { professionalId: moretti, ...period, mode: "PROFESSIONAL" });
    expect(byProfessional.lines.map((l) => [l.treatment, l.collected, l.percent, l.commission])).toEqual([
      ["Limpieza", 15000, 40, 6000],
      ["Implante", 40000, 40, 16000],
    ]);
    expect(byProfessional.totalCommission).toBe(22000);

    const byTreatment = await getLiquidationPreview(clinicA.id, { professionalId: moretti, ...period, mode: "TREATMENT" });
    expect(byTreatment.lines.map((l) => [l.treatment, l.percent, l.commission])).toEqual([
      ["Limpieza", 40, 6000],
      ["Implante", 50, 20000],
    ]);
  });

  it("counts a payment on the period's last day, and rejects a period that ends before it starts", async () => {
    await consulta(moretti, "Limpieza", [[1000, new Date(2026, 9, 31, 23, 30)]]);
    const preview = await getLiquidationPreview(clinicA.id, { professionalId: moretti, ...period, mode: "PROFESSIONAL" });
    expect(preview.totalCollected).toBe(1000);
    await expect(
      getLiquidationPreview(clinicA.id, { professionalId: moretti, from: "2026-10-31", to: "2026-10-01", mode: "PROFESSIONAL" }),
    ).rejects.toThrow("La fecha hasta tiene que ser igual o posterior a la desde");
  });
});

describe("liquidations", () => {
  it("are saved as calculated, numbered per clinic, and can't overlap for the same professional", async () => {
    await consulta(moretti, "Limpieza", [[10000, oct(5)]]);
    await consulta(benitez, "Limpieza", [[10000, oct(5)]]);
    await updateProfessional(clinicA.id, benitez, { title: "Dr.", name: "Andrés Benítez", license: "MP 2", commissionPercent: 30 });

    const first = await createLiquidation(clinicA.id, { professionalId: moretti, ...period, mode: "PROFESSIONAL" });
    expect(first).toMatchObject({ number: 1, professionalName: "Dra. Valeria Moretti", totalCollected: 10000, totalCommission: 4000 });

    // Changing the % later doesn't touch what was liquidated.
    await updateProfessional(clinicA.id, moretti, { title: "Dra.", name: "Valeria Moretti", license: "MP 1", commissionPercent: 10 });
    expect((await getLiquidation(clinicA.id, first.id))!.totalCommission).toBe(4000);

    await expect(
      createLiquidation(clinicA.id, { professionalId: moretti, from: "2026-10-15", to: "2026-11-15", mode: "TREATMENT" }),
    ).rejects.toThrow("Ya hay una liquidación de Dra. Valeria Moretti del 01/10/2026 al 31/10/2026");
    const other = await createLiquidation(clinicA.id, { professionalId: benitez, ...period, mode: "PROFESSIONAL" });
    expect(other.number).toBe(2);
    expect((await getLiquidations(clinicA.id, { professionalId: benitez })).map((l) => l.id)).toEqual([other.id]);
    expect((await getLiquidations(clinicA.id, { mode: "TREATMENT" })).length).toBe(0);
  });

  it("refuses a period with nothing collected", async () => {
    await expect(createLiquidation(clinicA.id, { professionalId: moretti, ...period, mode: "PROFESSIONAL" })).rejects.toThrow(
      "No hay cobros de Dra. Valeria Moretti en ese período",
    );
  });

  it("are marked paid, unmarked and deleted only within their clinic", async () => {
    await consulta(moretti, "Limpieza", [[10000, oct(5)]]);
    const liquidation = await createLiquidation(clinicA.id, { professionalId: moretti, ...period, mode: "PROFESSIONAL" });
    await expect(setLiquidationPaid(clinicB.id, liquidation.id, true)).rejects.toThrow();
    expect((await setLiquidationPaid(clinicA.id, liquidation.id, true)).paidAt).not.toBeNull();
    expect((await setLiquidationPaid(clinicA.id, liquidation.id, false)).paidAt).toBeNull();
    expect(await getLiquidations(clinicB.id, {})).toEqual([]);
    await expect(deleteLiquidation(clinicB.id, liquidation.id)).rejects.toThrow();
    await deleteLiquidation(clinicA.id, liquidation.id);
    expect(await getLiquidations(clinicA.id, {})).toEqual([]);
  });

  it("won't liquidate another clinic's professional", async () => {
    const theirs = (await createProfessional(clinicB.id, { title: "Dr.", name: "Otro", license: "1" })).id;
    await expect(
      getLiquidationPreview(clinicA.id, { professionalId: theirs, ...period, mode: "PROFESSIONAL" }),
    ).rejects.toThrow("Elegí un profesional del consultorio");
  });
});
