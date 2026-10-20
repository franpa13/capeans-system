import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPatient } from "@/features/clinic/data/patients";
import {
  createAppointment,
  deleteAppointment,
  getAppointment,
  getAppointments,
  getLinkableAppointments,
  countNoShows,
  markReminderSent,
  updateAppointment,
} from "@/features/clinic/data/appointments";
import { createConsultation } from "@/features/clinic/data/consultations";

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

  // findConflict queried every non-cancelled appointment the clinic ever
  // had (no lower bound on startsAt) to check a single new slot — fine
  // with a handful of rows, but it means every create/update gets slower
  // forever as the clinic's history grows. A candidate can only overlap
  // the new slot if it starts after some bounded lookback window, so the
  // query should never need to reach further back than that.
  it("scopes the conflict-detection query to a bounded window instead of the clinic's full history", async () => {
    const findManySpy = vi.spyOn(prisma.appointment, "findMany");

    const startsAt = new Date("2026-02-02T10:00:00Z");
    await createAppointment(clinicA.id, { startsAt, durationMinutes: 30 });

    const conflictCall = findManySpy.mock.calls.find(
      ([args]) => (args?.where as { clinicId?: string })?.clinicId === clinicA.id,
    );
    expect(conflictCall).toBeDefined();
    const where = conflictCall![0]!.where as { startsAt?: { gte?: Date; lt?: Date } };

    expect(where.startsAt?.gte).toBeInstanceOf(Date);
    expect(where.startsAt!.gte!.getTime()).toBeLessThan(startsAt.getTime());

    findManySpy.mockRestore();
  });
});

describe("linking turnos to consultas", () => {
  // Local-time constructors on purpose: the "day" a dentist picks in the
  // consultation form is a local calendar date, not a UTC one.
  const dayAt = (hour: number, day = 2) => new Date(2026, 1, day, hour, 0);

  it("lists a patient's turnos on the given day, earliest first", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const late = await createAppointment(clinicA.id, { patientId: patient.id, startsAt: dayAt(15) });
    const early = await createAppointment(clinicA.id, { patientId: patient.id, startsAt: dayAt(9) });

    const result = await getLinkableAppointments(clinicA.id, patient.id, "2026-02-02");
    expect(result.map((a) => a.id)).toEqual([early.id, late.id]);
  });

  it("excludes turnos on other days, of other patients, and cancelled ones", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const other = await createPatient(clinicA.id, { name: "Paciente B", phone: "222" });
    const match = await createAppointment(clinicA.id, { patientId: patient.id, startsAt: dayAt(9) });
    await createAppointment(clinicA.id, { patientId: patient.id, startsAt: dayAt(9, 3) });
    await createAppointment(clinicA.id, { patientId: other.id, startsAt: dayAt(11) });
    await createAppointment(clinicA.id, {
      patientId: patient.id,
      startsAt: dayAt(13),
      status: "CANCELLED",
    });

    const result = await getLinkableAppointments(clinicA.id, patient.id, "2026-02-02");
    expect(result.map((a) => a.id)).toEqual([match.id]);
  });

  it("excludes a turno already linked to another consulta, but keeps the excluded consulta's own", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const linked = await createAppointment(clinicA.id, { patientId: patient.id, startsAt: dayAt(9) });
    const free = await createAppointment(clinicA.id, { patientId: patient.id, startsAt: dayAt(15) });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: dayAt(9),
      treatment: "Limpieza",
      appointmentId: linked.id,
    });

    const forNew = await getLinkableAppointments(clinicA.id, patient.id, "2026-02-02");
    expect(forNew.map((a) => a.id)).toEqual([free.id]);

    const forEditingThatConsulta = await getLinkableAppointments(
      clinicA.id,
      patient.id,
      "2026-02-02",
      consultation.id,
    );
    expect(forEditingThatConsulta.map((a) => a.id)).toEqual([linked.id, free.id]);
  });

  it("does not leak another clinic's turnos", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    await createAppointment(clinicA.id, { patientId: patient.id, startsAt: dayAt(9) });

    expect(await getLinkableAppointments(clinicB.id, patient.id, "2026-02-02")).toHaveLength(0);
  });

  it("getAppointments tells which turnos already have a consulta", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const withConsulta = await createAppointment(clinicA.id, {
      patientId: patient.id,
      startsAt: dayAt(9),
    });
    const without = await createAppointment(clinicA.id, { patientId: patient.id, startsAt: dayAt(15) });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: dayAt(9),
      treatment: "Limpieza",
      appointmentId: withConsulta.id,
    });

    const list = await getAppointments(clinicA.id);
    expect(list.find((a) => a.id === withConsulta.id)?.consultation?.id).toBe(consultation.id);
    expect(list.find((a) => a.id === without.id)?.consultation).toBeNull();
  });
});

describe("turno reminders", () => {
  it("records when the reminder was sent", async () => {
    const appointment = await createAppointment(clinicA.id, {
      startsAt: new Date("2026-02-02T10:00:00Z"),
    });
    expect(appointment.reminderSentAt).toBeNull();

    const before = Date.now();
    const updated = await markReminderSent(clinicA.id, appointment.id);
    expect(updated.reminderSentAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect((await getAppointment(clinicA.id, appointment.id))!.reminderSentAt).not.toBeNull();
  });

  it("refuses marking another clinic's turno", async () => {
    const appointment = await createAppointment(clinicB.id, {
      startsAt: new Date("2026-02-02T10:00:00Z"),
    });
    await expect(markReminderSent(clinicA.id, appointment.id)).rejects.toThrow(
      "Appointment not found for this clinic",
    );
    expect((await getAppointment(clinicB.id, appointment.id))!.reminderSentAt).toBeNull();
  });
});

describe("no-shows", () => {
  it("frees the slot of a turno the patient didn't come to", async () => {
    const startsAt = new Date("2026-02-02T10:00:00Z");
    const first = await createAppointment(clinicA.id, { startsAt });
    await updateAppointment(clinicA.id, first.id, { status: "NO_SHOW" });
    await expect(createAppointment(clinicA.id, { startsAt })).resolves.toBeDefined();
  });

  it("isn't offered for linking to a consulta", async () => {
    const patient = await createPatient(clinicA.id, { name: "Ana", phone: "1" });
    const appointment = await createAppointment(clinicA.id, {
      patientId: patient.id,
      startsAt: new Date(2026, 1, 2, 10, 0),
    });
    await updateAppointment(clinicA.id, appointment.id, { status: "NO_SHOW" });
    await expect(getLinkableAppointments(clinicA.id, patient.id, "2026-02-02")).resolves.toEqual([]);
    await expect(
      createConsultation(clinicA.id, {
        patientId: patient.id,
        date: new Date(2026, 1, 2, 10, 0),
        treatment: "Limpieza",
        appointmentId: appointment.id,
      }),
    ).rejects.toThrow("No se puede vincular un turno al que el paciente no vino");
  });

  it("counts a patient's no-shows, only in their own clinic", async () => {
    const patient = await createPatient(clinicA.id, { name: "Ana", phone: "1" });
    for (const [hour, status] of [
      [9, "NO_SHOW"],
      [10, "NO_SHOW"],
      [11, "COMPLETED"],
    ] as const) {
      const a = await createAppointment(clinicA.id, {
        patientId: patient.id,
        startsAt: new Date(2026, 1, 2, hour, 0),
      });
      await updateAppointment(clinicA.id, a.id, { status });
    }
    await expect(countNoShows(clinicA.id, patient.id)).resolves.toBe(2);
    await expect(countNoShows(clinicB.id, patient.id)).resolves.toBe(0);
  });
});

describe("en sala de espera", () => {
  it("still takes up its slot", async () => {
    const startsAt = new Date("2026-02-02T10:00:00Z");
    const turno = await createAppointment(clinicA.id, { startsAt });
    await updateAppointment(clinicA.id, turno.id, { status: "WAITING" });
    await expect(createAppointment(clinicA.id, { startsAt })).rejects.toThrow(
      "Ya hay un turno agendado en ese horario",
    );
  });

  it("counts as confirmed in the agenda's default filter", async () => {
    const waiting = await createAppointment(clinicA.id, { startsAt: new Date("2026-02-02T10:00:00Z") });
    await updateAppointment(clinicA.id, waiting.id, { status: "WAITING" });
    await createAppointment(clinicA.id, { startsAt: new Date("2026-02-02T11:00:00Z") });
    const confirmed = await getAppointments(clinicA.id, undefined, "CONFIRMED");
    expect(confirmed.map((a) => a.status).sort()).toEqual(["CONFIRMED", "WAITING"]);
  });

  it("is completed when its consulta is registered", async () => {
    const patient = await createPatient(clinicA.id, { name: "Ana", phone: "1" });
    const turno = await createAppointment(clinicA.id, {
      patientId: patient.id,
      startsAt: new Date(2026, 1, 2, 10, 0),
    });
    await updateAppointment(clinicA.id, turno.id, { status: "WAITING" });
    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date(2026, 1, 2, 10, 0),
      treatment: "Limpieza",
      appointmentId: turno.id,
    });
    expect((await getAppointment(clinicA.id, turno.id))!.status).toBe("COMPLETED");
  });
});
