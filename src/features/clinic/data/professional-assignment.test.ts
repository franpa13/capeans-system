import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPatient } from "@/features/clinic/data/patients";
import { createProfessional } from "@/features/clinic/data/professionals";
import {
  createAppointment,
  getAppointments,
  updateAppointment,
} from "@/features/clinic/data/appointments";
import { createConsultation, updateConsultation } from "@/features/clinic/data/consultations";
import { ensureMember, setMemberProfessional } from "@/features/clinic/data/members";

let clinicA: { id: string };
let clinicB: { id: string };
let patientId: string;
let draMoretti: string;
let drBenitez: string;

const pro = (name: string) => ({ title: "Dra.", name, license: "MP 1" });
const at = (hour: number) => new Date(2026, 10, 3, hour, 0);

beforeEach(async () => {
  clinicA = await prisma.clinic.create({ data: { clerkOrgId: `org_a_${Date.now()}`, name: "Clínica A" } });
  clinicB = await prisma.clinic.create({ data: { clerkOrgId: `org_b_${Date.now()}`, name: "Clínica B" } });
  patientId = (await createPatient(clinicA.id, { name: "Ana Gómez", phone: "1" })).id;
  draMoretti = (await createProfessional(clinicA.id, pro("Valeria Moretti"))).id;
  drBenitez = (await createProfessional(clinicA.id, pro("Andrés Benítez"))).id;
});

afterEach(async () => {
  await prisma.consultation.deleteMany({});
  await prisma.appointment.deleteMany({});
  await prisma.clinicMember.deleteMany({});
  await prisma.professional.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.clinic.deleteMany({});
});

describe("turnos with a professional", () => {
  it("lets two professionals attend at the same time, but not one professional twice", async () => {
    await createAppointment(clinicA.id, { startsAt: at(10), professionalId: draMoretti });
    const other = await createAppointment(clinicA.id, { startsAt: at(10), professionalId: drBenitez });
    expect(other.professionalId).toBe(drBenitez);
    await expect(createAppointment(clinicA.id, { startsAt: at(10), professionalId: draMoretti })).rejects.toThrow(
      "Ya hay un turno agendado en ese horario",
    );
  });

  it("treats an unassigned turno as taking the slot for everyone", async () => {
    await createAppointment(clinicA.id, { startsAt: at(10) });
    await expect(createAppointment(clinicA.id, { startsAt: at(10), professionalId: draMoretti })).rejects.toThrow();
    await createAppointment(clinicA.id, { startsAt: at(11), professionalId: draMoretti });
    await expect(createAppointment(clinicA.id, { startsAt: at(11) })).rejects.toThrow();
  });

  it("checks the professional's agenda when a turno is reassigned", async () => {
    await createAppointment(clinicA.id, { startsAt: at(10), professionalId: draMoretti });
    const turno = await createAppointment(clinicA.id, { startsAt: at(10), professionalId: drBenitez });
    await expect(updateAppointment(clinicA.id, turno.id, { professionalId: draMoretti })).rejects.toThrow();
    // Unassigned, it would take the slot for everyone — Moretti is busy.
    await expect(updateAppointment(clinicA.id, turno.id, { professionalId: null })).rejects.toThrow();
    const moved = await updateAppointment(clinicA.id, turno.id, { startsAt: at(11), professionalId: null });
    expect(moved.professionalId).toBeNull();
  });

  it("won't use another clinic's professional", async () => {
    const theirs = (await createProfessional(clinicB.id, pro("Otra"))).id;
    await expect(createAppointment(clinicA.id, { startsAt: at(10), professionalId: theirs })).rejects.toThrow(
      "Elegí un profesional del consultorio",
    );
  });

  it("filters the agenda by professional", async () => {
    await createAppointment(clinicA.id, { startsAt: at(10), professionalId: draMoretti });
    await createAppointment(clinicA.id, { startsAt: at(11), professionalId: drBenitez });
    await createAppointment(clinicA.id, { startsAt: at(12) });
    const range = { from: at(0), to: at(23) };
    expect((await getAppointments(clinicA.id, range, undefined, draMoretti)).map((a) => a.startsAt.getHours())).toEqual([10]);
    expect((await getAppointments(clinicA.id, range)).length).toBe(3);
  });
});

describe("consultas with a professional", () => {
  it("records who attended, taking the turno's professional when not told", async () => {
    const turno = await createAppointment(clinicA.id, { patientId, startsAt: at(10), professionalId: drBenitez });
    const fromTurno = await createConsultation(clinicA.id, {
      patientId,
      date: at(10),
      treatment: "Limpieza",
      appointmentId: turno.id,
    });
    expect(fromTurno.professionalId).toBe(drBenitez);

    const chosen = await createConsultation(clinicA.id, {
      patientId,
      date: at(12),
      treatment: "Limpieza",
      professionalId: draMoretti,
    });
    expect(chosen.professionalId).toBe(draMoretti);
    const edited = await updateConsultation(clinicA.id, chosen.id, {
      date: at(12),
      treatment: "Limpieza",
      professionalId: drBenitez,
    });
    expect(edited.professionalId).toBe(drBenitez);
  });
});

describe("a team member's professional profile", () => {
  it("links a member to one professional, never two people to the same one", async () => {
    const owner = await ensureMember(clinicA.id, { clerkUserId: "u1", name: "Dueña", emails: ["a@x.com"], isOrgAdmin: false });
    const other = await ensureMember(clinicA.id, { clerkUserId: "u2", name: "Otro", emails: ["b@x.com"], isOrgAdmin: false });
    const linked = await setMemberProfessional(clinicA.id, owner.id, draMoretti);
    expect(linked.professionalId).toBe(draMoretti);
    await expect(setMemberProfessional(clinicA.id, other.id, draMoretti)).rejects.toThrow(
      "Ese profesional ya está vinculado a otra persona del equipo",
    );
    expect((await setMemberProfessional(clinicA.id, owner.id, null)).professionalId).toBeNull();

    const theirs = (await createProfessional(clinicB.id, pro("Otra"))).id;
    await expect(setMemberProfessional(clinicA.id, owner.id, theirs)).rejects.toThrow();
  });
});
