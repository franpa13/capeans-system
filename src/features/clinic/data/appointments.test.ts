import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPatient } from "@/features/clinic/data/patients";
import {
  createAppointment,
  deleteAppointment,
  getAppointment,
  getAppointments,
  updateAppointment,
} from "@/features/clinic/data/appointments";

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
  await prisma.appointment.deleteMany({});
  await prisma.consultation.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.clinic.deleteMany({});
});

describe("appointments data layer", () => {
  it("creates an appointment scoped to the given clinic", async () => {
    const appointment = await createAppointment(clinicA.id, {
      startsAt: new Date("2026-02-02T10:00:00Z"),
      durationMinutes: 30,
    });
    expect(appointment.clinicId).toBe(clinicA.id);
    expect(appointment.status).toBe("CONFIRMED");
  });

  it("does not return a clinic A appointment when queried with clinic B's id", async () => {
    const appointment = await createAppointment(clinicA.id, {
      startsAt: new Date("2026-02-02T10:00:00Z"),
    });
    const result = await getAppointment(clinicB.id, appointment.id);
    expect(result).toBeNull();
  });

  it("lists only appointments belonging to the requested clinic", async () => {
    await createAppointment(clinicA.id, { startsAt: new Date("2026-02-02T10:00:00Z") });
    await createAppointment(clinicB.id, { startsAt: new Date("2026-02-02T11:00:00Z") });

    const listA = await getAppointments(clinicA.id);
    expect(listA).toHaveLength(1);
  });

  it("filters appointments by a date range", async () => {
    await createAppointment(clinicA.id, { startsAt: new Date("2026-02-02T10:00:00Z") });
    await createAppointment(clinicA.id, { startsAt: new Date("2026-02-10T10:00:00Z") });

    const result = await getAppointments(clinicA.id, {
      from: new Date("2026-02-01T00:00:00Z"),
      to: new Date("2026-02-03T00:00:00Z"),
    });
    expect(result).toHaveLength(1);
  });

  it("filters appointments by status", async () => {
    const confirmed = await createAppointment(clinicA.id, {
      startsAt: new Date("2026-02-02T10:00:00Z"),
    });
    const toCancel = await createAppointment(clinicA.id, {
      startsAt: new Date("2026-02-02T14:00:00Z"),
    });
    await updateAppointment(clinicA.id, toCancel.id, { status: "CANCELLED" });

    const confirmedOnly = await getAppointments(clinicA.id, undefined, "CONFIRMED");
    expect(confirmedOnly.map((a) => a.id)).toEqual([confirmed.id]);

    const cancelledOnly = await getAppointments(clinicA.id, undefined, "CANCELLED");
    expect(cancelledOnly.map((a) => a.id)).toEqual([toCancel.id]);

    const all = await getAppointments(clinicA.id);
    expect(all).toHaveLength(2);
  });

  it("refuses to create an appointment that overlaps an existing one in the same clinic", async () => {
    await createAppointment(clinicA.id, {
      startsAt: new Date("2026-02-02T10:00:00Z"),
      durationMinutes: 60,
    });

    await expect(
      createAppointment(clinicA.id, {
        startsAt: new Date("2026-02-02T10:30:00Z"),
        durationMinutes: 30,
      }),
    ).rejects.toThrow("Ya hay un turno agendado en ese horario");
  });

  it("allows an overlapping time in a different clinic", async () => {
    await createAppointment(clinicA.id, {
      startsAt: new Date("2026-02-02T10:00:00Z"),
      durationMinutes: 60,
    });

    const appointment = await createAppointment(clinicB.id, {
      startsAt: new Date("2026-02-02T10:30:00Z"),
      durationMinutes: 30,
    });
    expect(appointment.clinicId).toBe(clinicB.id);
  });

  it("allows a new appointment in a slot freed by a cancelled one", async () => {
    const cancelled = await createAppointment(clinicA.id, {
      startsAt: new Date("2026-02-02T10:00:00Z"),
      durationMinutes: 60,
    });
    await updateAppointment(clinicA.id, cancelled.id, { status: "CANCELLED" });

    const appointment = await createAppointment(clinicA.id, {
      startsAt: new Date("2026-02-02T10:00:00Z"),
      durationMinutes: 30,
    });
    expect(appointment.id).not.toBe(cancelled.id);
  });

  it("refuses to reschedule an appointment into a slot taken by another one", async () => {
    await createAppointment(clinicA.id, {
      startsAt: new Date("2026-02-02T10:00:00Z"),
      durationMinutes: 30,
    });
    const movable = await createAppointment(clinicA.id, {
      startsAt: new Date("2026-02-02T14:00:00Z"),
      durationMinutes: 30,
    });

    await expect(
      updateAppointment(clinicA.id, movable.id, {
        startsAt: new Date("2026-02-02T10:15:00Z"),
      }),
    ).rejects.toThrow("Ya hay un turno agendado en ese horario");
  });

  it("allows rescheduling an appointment to its own current time", async () => {
    const appointment = await createAppointment(clinicA.id, {
      startsAt: new Date("2026-02-02T10:00:00Z"),
      durationMinutes: 30,
    });

    const updated = await updateAppointment(clinicA.id, appointment.id, {
      reason: "Control de rutina",
    });
    expect(updated.reason).toBe("Control de rutina");
  });

  it("refuses to attach a patient from another clinic", async () => {
    const otherClinicPatient = await createPatient(clinicB.id, {
      name: "Paciente B",
      phone: "222",
    });

    await expect(
      createAppointment(clinicA.id, {
        startsAt: new Date("2026-02-02T10:00:00Z"),
        patientId: otherClinicPatient.id,
      }),
    ).rejects.toThrow("Patient not found for this clinic");
  });

  it("refuses to update an appointment belonging to another clinic", async () => {
    const appointment = await createAppointment(clinicA.id, {
      startsAt: new Date("2026-02-02T10:00:00Z"),
    });

    await expect(
      updateAppointment(clinicB.id, appointment.id, { reason: "Hackeado" }),
    ).rejects.toThrow("Appointment not found for this clinic");
  });

  it("refuses to delete an appointment belonging to another clinic", async () => {
    const appointment = await createAppointment(clinicA.id, {
      startsAt: new Date("2026-02-02T10:00:00Z"),
    });

    await deleteAppointment(clinicB.id, appointment.id);

    const stillThere = await getAppointment(clinicA.id, appointment.id);
    expect(stillThere).not.toBeNull();
  });

  it("ignores a clinicId injected into the create input, using the argument instead", async () => {
    const injected = {
      startsAt: new Date("2026-02-02T10:00:00Z"),
      clinicId: clinicB.id,
    } as Parameters<typeof createAppointment>[1];

    const appointment = await createAppointment(clinicA.id, injected);
    expect(appointment.clinicId).toBe(clinicA.id);
  });

  // Mirrors how the "Agregar paciente nuevo" flow in the turno dialog
  // calls these two together inside one prisma.$transaction: if a patient
  // created alongside a new appointment were committed even when the
  // appointment itself fails (a conflicting slot), retrying the save —
  // which real users do, since the dialog stays open on failure — would
  // leave a duplicate orphan patient behind on every retry.
  it("rolls back a patient created alongside a conflicting appointment in the same transaction", async () => {
    await createAppointment(clinicA.id, {
      startsAt: new Date("2026-02-02T10:00:00Z"),
      durationMinutes: 60,
    });

    await expect(
      prisma.$transaction(async (tx) => {
        const patient = await createPatient(
          clinicA.id,
          { name: "Paciente Transacción", phone: "111" },
          tx,
        );
        await createAppointment(
          clinicA.id,
          { startsAt: new Date("2026-02-02T10:30:00Z"), durationMinutes: 30, patientId: patient.id },
          tx,
        );
      }),
    ).rejects.toThrow("Ya hay un turno agendado en ese horario");

    const patients = await prisma.patient.findMany({ where: { clinicId: clinicA.id } });
    expect(patients).toHaveLength(0);
  });
});
