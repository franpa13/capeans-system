import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPatient } from "@/features/clinic/data/patients";
import { createClinicOption, updateClinicOption } from "@/features/clinic/data/clinic-options";
import { createAppointment, getAppointment } from "@/features/clinic/data/appointments";
import { createSupply } from "@/features/clinic/data/supplies";
import {
  createConsultation,
  deleteConsultation,
  getConsultation,
  getConsultations,
  getConsultationsForPatient,
  updateConsultation,
} from "@/features/clinic/data/consultations";

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
  await prisma.supply.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.clinic.deleteMany({});
});

describe("consultations data layer", () => {
  it("creates a consultation scoped to the given clinic", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
    });
    expect(consultation.clinicId).toBe(clinicA.id);
  });

  it("persists multiple teeth on a single consultation", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
      teeth: ["16", "17", "26"],
    });
    expect(consultation.teeth).toEqual(["16", "17", "26"]);
  });

  it("defaults to an empty teeth array when none is given", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
    });
    expect(consultation.teeth).toEqual([]);
  });

  it("does not return a clinic A consultation when queried with clinic B's id", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
    });
    const result = await getConsultation(clinicB.id, consultation.id);
    expect(result).toBeNull();
  });

  it("lists only consultations belonging to the requested clinic", async () => {
    const patientA = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const patientB = await createPatient(clinicB.id, { name: "Paciente B", phone: "222" });
    await createConsultation(clinicA.id, {
      patientId: patientA.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
    });
    await createConsultation(clinicB.id, {
      patientId: patientB.id,
      date: new Date("2026-01-02"),
      treatment: "Extracción",
    });

    const listA = await getConsultations(clinicA.id);
    expect(listA).toHaveLength(1);
    expect(listA[0].treatment).toBe("Limpieza");
  });

  it("returns only the given patient's consultations, scoped to the clinic", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const otherPatient = await createPatient(clinicA.id, { name: "Paciente B", phone: "222" });
    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
    });
    await createConsultation(clinicA.id, {
      patientId: otherPatient.id,
      date: new Date("2026-01-02"),
      treatment: "Extracción",
    });

    const result = await getConsultationsForPatient(clinicA.id, patient.id);
    expect(result).toHaveLength(1);
    expect(result[0].treatment).toBe("Limpieza");
  });

  it("ignores a clinicId injected into the create input, using the argument instead", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const injected = {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
      clinicId: clinicB.id,
    } as Parameters<typeof createConsultation>[1];

    const consultation = await createConsultation(clinicA.id, injected);

    expect(consultation.clinicId).toBe(clinicA.id);
  });

  it("refuses to create a consultation for a patient belonging to another clinic", async () => {
    const otherClinicPatient = await createPatient(clinicB.id, { name: "Paciente B", phone: "222" });

    await expect(
      createConsultation(clinicA.id, {
        patientId: otherClinicPatient.id,
        date: new Date("2026-01-01"),
        treatment: "Limpieza",
      }),
    ).rejects.toThrow("Patient not found for this clinic");
  });

  it("updates a consultation's editable fields", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
      teeth: ["16"],
      notes: "Original",
    });

    const updated = await updateConsultation(clinicA.id, consultation.id, {
      date: new Date("2026-02-02"),
      treatment: "Extracción",
      teeth: ["17", "18"],
      notes: "Corregido",
    });

    expect(updated.date).toEqual(new Date("2026-02-02"));
    expect(updated.treatment).toBe("Extracción");
    expect(updated.teeth).toEqual(["17", "18"]);
    expect(updated.notes).toBe("Corregido");
  });

  it("does not update a consultation belonging to another clinic", async () => {
    const patient = await createPatient(clinicB.id, { name: "Paciente B", phone: "222" });
    const consultation = await createConsultation(clinicB.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
    });

    await expect(
      updateConsultation(clinicA.id, consultation.id, {
        date: new Date("2026-02-02"),
        treatment: "Extracción",
      }),
    ).rejects.toThrow("Consultation not found for this clinic");
  });

  it("deletes a consultation scoped to the given clinic", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
    });

    await deleteConsultation(clinicA.id, consultation.id);

    expect(await getConsultation(clinicA.id, consultation.id)).toBeNull();
  });

  it("does not delete a consultation belonging to another clinic", async () => {
    const patient = await createPatient(clinicB.id, { name: "Paciente B", phone: "222" });
    const consultation = await createConsultation(clinicB.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
    });

    await deleteConsultation(clinicA.id, consultation.id);

    expect(await getConsultation(clinicB.id, consultation.id)).not.toBeNull();
  });

  it("creates a consultation with an amount charged and paid", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
      amountCharged: 15000,
      amountPaid: 15000,
    });
    expect(consultation.amountCharged).toBe(15000);
    expect(consultation.amountPaid).toBe(15000);
  });

  it("defaults amountCharged to null and amountPaid to 0 when neither is given", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
    });
    expect(consultation.amountCharged).toBeNull();
    expect(consultation.amountPaid).toBe(0);
  });

  it("refuses a negative amountCharged on create", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    await expect(
      createConsultation(clinicA.id, {
        patientId: patient.id,
        date: new Date("2026-01-01"),
        treatment: "Limpieza",
        amountCharged: -100,
      }),
    ).rejects.toThrow("El monto no puede ser negativo");
  });

  it("refuses a non-integer amountCharged on create", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    await expect(
      createConsultation(clinicA.id, {
        patientId: patient.id,
        date: new Date("2026-01-01"),
        treatment: "Limpieza",
        amountCharged: 1.5,
      }),
    ).rejects.toThrow("El monto tiene que ser un número entero");
  });

  it("refuses a NaN amountCharged on create", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    await expect(
      createConsultation(clinicA.id, {
        patientId: patient.id,
        date: new Date("2026-01-01"),
        treatment: "Limpieza",
        amountCharged: NaN,
      }),
    ).rejects.toThrow("El monto tiene que ser un número entero");
  });

  it("refuses amountPaid greater than amountCharged on create", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    await expect(
      createConsultation(clinicA.id, {
        patientId: patient.id,
        date: new Date("2026-01-01"),
        treatment: "Limpieza",
        amountCharged: 10000,
        amountPaid: 15000,
      }),
    ).rejects.toThrow("Lo pagado no puede superar el monto a cobrar");
  });

  it("updates a consultation's amount and payment", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
      amountCharged: 15000,
      amountPaid: 0,
    });

    const updated = await updateConsultation(clinicA.id, consultation.id, {
      date: consultation.date,
      treatment: consultation.treatment,
      amountCharged: 15000,
      amountPaid: 15000,
    });

    expect(updated.amountPaid).toBe(15000);
  });

  it("refuses amountPaid greater than amountCharged on update", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
      amountCharged: 10000,
    });

    await expect(
      updateConsultation(clinicA.id, consultation.id, {
        date: consultation.date,
        treatment: consultation.treatment,
        amountCharged: 10000,
        amountPaid: 50000,
      }),
    ).rejects.toThrow("Lo pagado no puede superar el monto a cobrar");
  });

  it("changing a treatment's list price later does not change a past consultation's amountCharged", async () => {
    // amountCharged is a snapshot taken at save time, not a live lookup —
    // there's no FK to ClinicOption at all. This test proves it by
    // actually moving the price after the fact, not just by construction:
    // a weaker version of this test that never touches the option's price
    // again would pass even if a bug introduced a live join somewhere.
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const treatmentOption = await createClinicOption(clinicA.id, "treatment", "Limpieza", 15000);
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
      amountCharged: treatmentOption.price!,
    });

    await updateClinicOption(clinicA.id, treatmentOption.id, "Limpieza", 25000);

    const reloaded = await getConsultation(clinicA.id, consultation.id);
    expect(reloaded?.amountCharged).toBe(15000);
  });

  it("filters consultations by a single payment status", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
      amountCharged: 15000,
      amountPaid: 15000,
    });
    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-02"),
      treatment: "Extracción",
      amountCharged: 20000,
      amountPaid: 0,
    });

    const paid = await getConsultations(clinicA.id, { paymentStatus: "COBRADO" });
    expect(paid).toHaveLength(1);
    expect(paid[0].treatment).toBe("Limpieza");
  });

  it("filters consultations by multiple payment statuses at once", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
      amountCharged: 15000,
      amountPaid: 0,
    });
    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-02"),
      treatment: "Extracción",
      amountCharged: 20000,
      amountPaid: 10000,
    });
    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-03"),
      treatment: "Endodoncia",
      amountCharged: 25000,
      amountPaid: 25000,
    });

    const owed = await getConsultations(clinicA.id, {
      paymentStatus: ["PENDIENTE", "PARCIAL"],
    });
    expect(owed).toHaveLength(2);
    expect(owed.map((c) => c.treatment).sort()).toEqual(["Extracción", "Limpieza"]);
  });

  it("combines the payment-status filter with an existing filter (treatment) instead of replacing it", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
      amountCharged: 15000,
      amountPaid: 0,
    });
    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-02"),
      treatment: "Extracción",
      amountCharged: 20000,
      amountPaid: 0,
    });

    const result = await getConsultations(clinicA.id, {
      treatment: "Limpieza",
      paymentStatus: "PENDIENTE",
    });
    expect(result).toHaveLength(1);
    expect(result[0].treatment).toBe("Limpieza");
  });

  describe("supplies used", () => {
    const stockOf = async (id: string) =>
      (await prisma.supply.findUniqueOrThrow({ where: { id } })).quantity;

    it("creating a consultation with supplies used decrements their stock and records the usage", async () => {
      const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
      const supply = await createSupply(clinicA.id, { name: "Gomillas", unit: "unidad", quantity: 100 });

      const consultation = await createConsultation(clinicA.id, {
        patientId: patient.id,
        date: new Date("2026-01-01"),
        treatment: "Ortodoncia",
        supplies: [{ supplyId: supply.id, quantityUsed: 12 }],
      });

      expect(await stockOf(supply.id)).toBe(88);
      const usages = await prisma.consultationSupply.findMany({
        where: { consultationId: consultation.id },
      });
      expect(usages).toHaveLength(1);
      expect(usages[0].supplyId).toBe(supply.id);
      expect(usages[0].quantityUsed).toBe(12);
    });

    it("allows stock to go negative when more is used than is available", async () => {
      const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
      const supply = await createSupply(clinicA.id, { name: "Gomillas", unit: "unidad", quantity: 5 });

      await createConsultation(clinicA.id, {
        patientId: patient.id,
        date: new Date("2026-01-01"),
        treatment: "Ortodoncia",
        supplies: [{ supplyId: supply.id, quantityUsed: 8 }],
      });

      expect(await stockOf(supply.id)).toBe(-3);
    });

    it("refuses a non-positive or non-integer quantityUsed", async () => {
      const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
      const supply = await createSupply(clinicA.id, { name: "Gomillas", unit: "unidad", quantity: 100 });
      const attempt = (quantityUsed: number) =>
        createConsultation(clinicA.id, {
          patientId: patient.id,
          date: new Date("2026-01-01"),
          treatment: "Ortodoncia",
          supplies: [{ supplyId: supply.id, quantityUsed }],
        });

      await expect(attempt(0)).rejects.toThrow(
        "La cantidad usada tiene que ser un número entero mayor a 0",
      );
      await expect(attempt(2.5)).rejects.toThrow(
        "La cantidad usada tiene que ser un número entero mayor a 0",
      );
      expect(await stockOf(supply.id)).toBe(100);
    });

    it("refuses another clinic's supply and leaves no half-created consultation behind", async () => {
      const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
      const foreign = await createSupply(clinicB.id, { name: "De B", unit: "unidad", quantity: 10 });

      await expect(
        createConsultation(clinicA.id, {
          patientId: patient.id,
          date: new Date("2026-01-01"),
          treatment: "Ortodoncia",
          supplies: [{ supplyId: foreign.id, quantityUsed: 1 }],
        }),
      ).rejects.toThrow("Insumo no encontrado");

      expect(await stockOf(foreign.id)).toBe(10);
      expect(await getConsultationsForPatient(clinicA.id, patient.id)).toHaveLength(0);
    });

    it("editing a consultation's supplies restores the old usage and applies the new one", async () => {
      const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
      const supplyA = await createSupply(clinicA.id, { name: "Gomillas", unit: "unidad", quantity: 100 });
      const supplyB = await createSupply(clinicA.id, { name: "Anestesia", unit: "ampolla", quantity: 50 });

      const consultation = await createConsultation(clinicA.id, {
        patientId: patient.id,
        date: new Date("2026-01-01"),
        treatment: "Ortodoncia",
        supplies: [{ supplyId: supplyA.id, quantityUsed: 10 }],
      });

      await updateConsultation(clinicA.id, consultation.id, {
        date: consultation.date,
        treatment: consultation.treatment,
        supplies: [{ supplyId: supplyB.id, quantityUsed: 3 }],
      });

      expect(await stockOf(supplyA.id)).toBe(100);
      expect(await stockOf(supplyB.id)).toBe(47);
      const usages = await prisma.consultationSupply.findMany({
        where: { consultationId: consultation.id },
      });
      expect(usages.map((u) => u.supplyId)).toEqual([supplyB.id]);
    });

    it("re-saving a consultation with the same supplies doesn't double-count", async () => {
      const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
      const supply = await createSupply(clinicA.id, { name: "Gomillas", unit: "unidad", quantity: 100 });
      const consultation = await createConsultation(clinicA.id, {
        patientId: patient.id,
        date: new Date("2026-01-01"),
        treatment: "Ortodoncia",
        supplies: [{ supplyId: supply.id, quantityUsed: 10 }],
      });

      for (let i = 0; i < 2; i++) {
        await updateConsultation(clinicA.id, consultation.id, {
          date: consultation.date,
          treatment: consultation.treatment,
          supplies: [{ supplyId: supply.id, quantityUsed: 10 }],
        });
      }

      expect(await stockOf(supply.id)).toBe(90);
    });

    it("editing a consultation to remove its supplies entirely restores the stock", async () => {
      const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
      const supply = await createSupply(clinicA.id, { name: "Gomillas", unit: "unidad", quantity: 100 });
      const consultation = await createConsultation(clinicA.id, {
        patientId: patient.id,
        date: new Date("2026-01-01"),
        treatment: "Ortodoncia",
        supplies: [{ supplyId: supply.id, quantityUsed: 10 }],
      });

      await updateConsultation(clinicA.id, consultation.id, {
        date: consultation.date,
        treatment: consultation.treatment,
      });

      expect(await stockOf(supply.id)).toBe(100);
      expect(
        await prisma.consultationSupply.findMany({ where: { consultationId: consultation.id } }),
      ).toHaveLength(0);
    });

    it("deleting a consultation with supplies restores their stock", async () => {
      const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
      const supply = await createSupply(clinicA.id, { name: "Gomillas", unit: "unidad", quantity: 100 });
      const consultation = await createConsultation(clinicA.id, {
        patientId: patient.id,
        date: new Date("2026-01-01"),
        treatment: "Ortodoncia",
        supplies: [{ supplyId: supply.id, quantityUsed: 10 }],
      });

      await deleteConsultation(clinicA.id, consultation.id);

      expect(await stockOf(supply.id)).toBe(100);
    });

    it("deleting another clinic's consultation restores nothing and deletes nothing", async () => {
      const patient = await createPatient(clinicB.id, { name: "Paciente B", phone: "222" });
      const supply = await createSupply(clinicB.id, { name: "Gomillas", unit: "unidad", quantity: 100 });
      const consultation = await createConsultation(clinicB.id, {
        patientId: patient.id,
        date: new Date("2026-01-01"),
        treatment: "Ortodoncia",
        supplies: [{ supplyId: supply.id, quantityUsed: 10 }],
      });

      await deleteConsultation(clinicA.id, consultation.id);

      expect(await stockOf(supply.id)).toBe(90);
      expect(await getConsultation(clinicB.id, consultation.id)).not.toBeNull();
    });
  });

  describe("linking to a turno", () => {
    const at = (hour: number) => new Date(2026, 1, 2, hour, 0);

    it("stores the link and marks a confirmed turno as completed", async () => {
      const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
      const appointment = await createAppointment(clinicA.id, {
        patientId: patient.id,
        startsAt: at(9),
      });

      const consultation = await createConsultation(clinicA.id, {
        patientId: patient.id,
        date: at(9),
        treatment: "Limpieza",
        appointmentId: appointment.id,
      });

      expect(consultation.appointmentId).toBe(appointment.id);
      expect((await getAppointment(clinicA.id, appointment.id))?.status).toBe("COMPLETED");
    });

    it("does not touch a turno when no link is given", async () => {
      const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
      const appointment = await createAppointment(clinicA.id, {
        patientId: patient.id,
        startsAt: at(9),
      });

      const consultation = await createConsultation(clinicA.id, {
        patientId: patient.id,
        date: at(9),
        treatment: "Limpieza",
      });

      expect(consultation.appointmentId).toBeNull();
      expect((await getAppointment(clinicA.id, appointment.id))?.status).toBe("CONFIRMED");
    });

    it("refuses linking to a cancelled turno", async () => {
      const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
      const appointment = await createAppointment(clinicA.id, {
        patientId: patient.id,
        startsAt: at(9),
        status: "CANCELLED",
      });

      await expect(
        createConsultation(clinicA.id, {
          patientId: patient.id,
          date: at(9),
          treatment: "Limpieza",
          appointmentId: appointment.id,
        }),
      ).rejects.toThrow("No se puede vincular un turno cancelado");
    });

    it("refuses linking to another patient's turno", async () => {
      const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
      const other = await createPatient(clinicA.id, { name: "Paciente B", phone: "222" });
      const appointment = await createAppointment(clinicA.id, {
        patientId: other.id,
        startsAt: at(9),
      });

      await expect(
        createConsultation(clinicA.id, {
          patientId: patient.id,
          date: at(9),
          treatment: "Limpieza",
          appointmentId: appointment.id,
        }),
      ).rejects.toThrow("El turno es de otro paciente");
    });

    it("refuses linking to another clinic's turno", async () => {
      const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
      const foreign = await createAppointment(clinicB.id, { startsAt: at(9) });

      await expect(
        createConsultation(clinicA.id, {
          patientId: patient.id,
          date: at(9),
          treatment: "Limpieza",
          appointmentId: foreign.id,
        }),
      ).rejects.toThrow("Turno no encontrado");
    });

    it("refuses linking a turno that already has another consulta", async () => {
      const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
      const appointment = await createAppointment(clinicA.id, {
        patientId: patient.id,
        startsAt: at(9),
      });
      await createConsultation(clinicA.id, {
        patientId: patient.id,
        date: at(9),
        treatment: "Limpieza",
        appointmentId: appointment.id,
      });

      await expect(
        createConsultation(clinicA.id, {
          patientId: patient.id,
          date: at(9),
          treatment: "Extracción",
          appointmentId: appointment.id,
        }),
      ).rejects.toThrow("Ese turno ya tiene una consulta registrada");
    });

    it("re-saving a consulta with its own turno is allowed, and the link can be cleared", async () => {
      const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
      const appointment = await createAppointment(clinicA.id, {
        patientId: patient.id,
        startsAt: at(9),
      });
      const consultation = await createConsultation(clinicA.id, {
        patientId: patient.id,
        date: at(9),
        treatment: "Limpieza",
        appointmentId: appointment.id,
      });

      const resaved = await updateConsultation(clinicA.id, consultation.id, {
        date: at(9),
        treatment: "Limpieza profunda",
        appointmentId: appointment.id,
      });
      expect(resaved.appointmentId).toBe(appointment.id);

      const cleared = await updateConsultation(clinicA.id, consultation.id, {
        date: at(9),
        treatment: "Limpieza profunda",
        appointmentId: null,
      });
      expect(cleared.appointmentId).toBeNull();
    });

    it("linking via update also marks a confirmed turno as completed", async () => {
      const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
      const appointment = await createAppointment(clinicA.id, {
        patientId: patient.id,
        startsAt: at(9),
      });
      const consultation = await createConsultation(clinicA.id, {
        patientId: patient.id,
        date: at(9),
        treatment: "Limpieza",
      });

      await updateConsultation(clinicA.id, consultation.id, {
        date: at(9),
        treatment: "Limpieza",
        appointmentId: appointment.id,
      });

      expect((await getAppointment(clinicA.id, appointment.id))?.status).toBe("COMPLETED");
    });
  });
});
