import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPatient } from "@/features/clinic/data/patients";
import {
  createConsultation,
  deleteConsultation,
  getConsultation,
  updateConsultation,
} from "@/features/clinic/data/consultations";
import {
  addPayment,
  deletePayment,
  getConsultationPayments,
  getPayments,
} from "@/features/clinic/data/payments";

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
  await prisma.payment.deleteMany({});
  await prisma.consultation.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.clinic.deleteMany({});
});

async function consultaOf(clinicId: string, amountCharged: number | undefined, amountPaid?: number) {
  const patient = await createPatient(clinicId, { name: "Ana", phone: "1" });
  return createConsultation(clinicId, {
    patientId: patient.id,
    date: new Date(2026, 0, 10, 10, 0),
    treatment: "Ortodoncia",
    amountCharged,
    amountPaid,
    paymentMethod: "TRANSFERENCIA",
  });
}

describe("payments", () => {
  it("records what's paid when a consulta is created, as a dated payment with its method", async () => {
    const consultation = await consultaOf(clinicA.id, 30000, 10000);
    const payments = await getConsultationPayments(clinicA.id, consultation.id);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ amount: 10000, method: "TRANSFERENCIA" });
    expect(payments[0].paidAt).toEqual(consultation.date);
  });

  it("creates no payment for an unpaid consulta", async () => {
    const consultation = await consultaOf(clinicA.id, 30000, 0);
    await expect(getConsultationPayments(clinicA.id, consultation.id)).resolves.toEqual([]);
  });

  it("adds installments, keeping the consulta's paid total in sync", async () => {
    const consultation = await consultaOf(clinicA.id, 30000, 10000);
    await addPayment(clinicA.id, consultation.id, {
      amount: 5000,
      method: "EFECTIVO",
      paidAt: new Date(2026, 1, 10),
    });
    expect((await getConsultation(clinicA.id, consultation.id))!.amountPaid).toBe(15000);
    expect(await getConsultationPayments(clinicA.id, consultation.id)).toHaveLength(2);
  });

  it("refuses a payment that would go over the amount to charge", async () => {
    const consultation = await consultaOf(clinicA.id, 30000, 25000);
    await expect(
      addPayment(clinicA.id, consultation.id, { amount: 6000, method: "EFECTIVO", paidAt: new Date() }),
    ).rejects.toThrow("Lo pagado no puede superar el monto a cobrar");
    expect((await getConsultation(clinicA.id, consultation.id))!.amountPaid).toBe(25000);
  });

  it("refuses a payment on a consulta with no amount to charge", async () => {
    const consultation = await consultaOf(clinicA.id, undefined);
    await expect(
      addPayment(clinicA.id, consultation.id, { amount: 100, method: "EFECTIVO", paidAt: new Date() }),
    ).rejects.toThrow("Primero cargá el monto a cobrar de la consulta");
  });

  it("refuses a zero, negative or fractional payment", async () => {
    const consultation = await consultaOf(clinicA.id, 30000);
    for (const amount of [0, -5, 10.5]) {
      await expect(
        addPayment(clinicA.id, consultation.id, { amount, method: "EFECTIVO", paidAt: new Date() }),
      ).rejects.toThrow("El pago tiene que ser un número entero mayor a 0");
    }
  });

  it("deleting a payment takes it off the paid total", async () => {
    const consultation = await consultaOf(clinicA.id, 30000, 10000);
    const [payment] = await getConsultationPayments(clinicA.id, consultation.id);
    await deletePayment(clinicA.id, payment.id);
    expect((await getConsultation(clinicA.id, consultation.id))!.amountPaid).toBe(0);
  });

  it("doesn't touch another clinic's consulta or payment", async () => {
    const theirs = await consultaOf(clinicB.id, 30000, 10000);
    await expect(
      addPayment(clinicA.id, theirs.id, { amount: 100, method: "EFECTIVO", paidAt: new Date() }),
    ).rejects.toThrow("Consultation not found for this clinic");
    const [payment] = await getConsultationPayments(clinicB.id, theirs.id);
    await expect(deletePayment(clinicA.id, payment.id)).rejects.toThrow(
      "Payment not found for this clinic",
    );
    await expect(getConsultationPayments(clinicA.id, theirs.id)).resolves.toEqual([]);
  });

  it("lists a period's payments with the patient and treatment, newest first", async () => {
    const consultation = await consultaOf(clinicA.id, 30000, 10000); // paid 10/01
    await addPayment(clinicA.id, consultation.id, {
      amount: 5000,
      method: "EFECTIVO",
      paidAt: new Date(2026, 1, 3),
    });
    await consultaOf(clinicB.id, 30000, 10000);

    const january = await getPayments(clinicA.id, {
      from: new Date(2026, 0, 1),
      to: new Date(2026, 1, 1),
    });
    expect(january.map((p) => p.amount)).toEqual([10000]);
    expect(january[0].consultation.treatment).toBe("Ortodoncia");
    expect(january[0].consultation.patient?.name).toBe("Ana");

    const all = await getPayments(clinicA.id, { from: new Date(2026, 0, 1), to: new Date(2026, 2, 1) });
    expect(all.map((p) => p.amount)).toEqual([5000, 10000]);
  });

  it("deleting a consulta deletes its payments", async () => {
    const consultation = await consultaOf(clinicA.id, 30000, 10000);
    await deleteConsultation(clinicA.id, consultation.id);
    await expect(prisma.payment.count()).resolves.toBe(0);
  });
});

describe("editing a consulta with payments", () => {
  it("keeps what was paid when the consulta is edited", async () => {
    const consultation = await consultaOf(clinicA.id, 30000, 10000);
    const updated = await updateConsultation(clinicA.id, consultation.id, {
      date: consultation.date,
      treatment: "Ortodoncia",
      amountCharged: 35000,
    });
    expect(updated.amountPaid).toBe(10000);
  });

  it("refuses lowering the amount to charge below what was already paid", async () => {
    const consultation = await consultaOf(clinicA.id, 30000, 10000);
    await expect(
      updateConsultation(clinicA.id, consultation.id, {
        date: consultation.date,
        treatment: "Ortodoncia",
        amountCharged: 5000,
      }),
    ).rejects.toThrow("Lo pagado no puede superar el monto a cobrar");
    await expect(
      updateConsultation(clinicA.id, consultation.id, {
        date: consultation.date,
        treatment: "Ortodoncia",
      }),
    ).rejects.toThrow("La consulta ya tiene pagos: no se puede quitar el monto a cobrar");
  });
});
