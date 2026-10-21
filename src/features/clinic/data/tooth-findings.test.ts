import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPatient } from "@/features/clinic/data/patients";
import { createConsultation, deleteConsultation } from "@/features/clinic/data/consultations";
import {
  addToothFindings,
  deleteToothFinding,
  getToothFindings,
  setToothFindingStatus,
} from "@/features/clinic/data/tooth-findings";

let clinicA: { id: string };
let clinicB: { id: string };
let patientId: string;

beforeEach(async () => {
  clinicA = await prisma.clinic.create({
    data: { clerkOrgId: `org_a_${Date.now()}`, name: "Clínica A" },
  });
  clinicB = await prisma.clinic.create({
    data: { clerkOrgId: `org_b_${Date.now()}`, name: "Clínica B" },
  });
  patientId = (await createPatient(clinicA.id, { name: "Ana Gómez", phone: "1" })).id;
});

afterEach(async () => {
  await prisma.toothFinding.deleteMany({});
  await prisma.consultation.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.clinic.deleteMany({});
});

describe("tooth findings (hallazgos)", () => {
  it("records a surface condition once per chosen surface, signed and dated", async () => {
    const created = await addToothFindings(clinicA.id, patientId, {
      tooth: "16",
      surfaces: ["O", "M"],
      condition: "caries",
      status: "PENDING",
      notes: "  profunda ",
      authorName: "Dra. Paz",
    });
    expect(created).toHaveLength(2);
    const findings = await getToothFindings(clinicA.id, patientId);
    expect(findings.map((f) => [f.tooth, f.surface, f.condition, f.status, f.notes, f.authorName]).sort()).toEqual([
      ["16", "M", "caries", "PENDING", "profunda", "Dra. Paz"],
      ["16", "O", "caries", "PENDING", "profunda", "Dra. Paz"],
    ]);
  });

  it("records a whole-tooth condition without a surface, and a done one as resolved", async () => {
    const [crown] = await addToothFindings(clinicA.id, patientId, {
      tooth: "46",
      condition: "corona",
      status: "DONE",
      authorName: null,
    });
    expect(crown.surface).toBeNull();
    expect(crown.resolvedAt).not.toBeNull();
  });

  it("rejects an unknown tooth, condition or surface, and a surface condition with no surface", async () => {
    const base = { condition: "caries", status: "PENDING" as const, authorName: null };
    await expect(addToothFindings(clinicA.id, patientId, { ...base, tooth: "19", surfaces: ["O"] })).rejects.toThrow(
      "Elegí una pieza válida",
    );
    await expect(
      addToothFindings(clinicA.id, patientId, { ...base, condition: "nada", tooth: "16", surfaces: ["O"] }),
    ).rejects.toThrow("Elegí un hallazgo de la lista");
    await expect(addToothFindings(clinicA.id, patientId, { ...base, tooth: "16", surfaces: [] })).rejects.toThrow(
      "Elegí al menos una cara",
    );
    await expect(
      addToothFindings(clinicA.id, patientId, { ...base, tooth: "16", surfaces: ["X" as never] }),
    ).rejects.toThrow("Elegí al menos una cara");
  });

  it("marks a finding done or back to pending", async () => {
    const [caries] = await addToothFindings(clinicA.id, patientId, {
      tooth: "16",
      surfaces: ["O"],
      condition: "caries",
      status: "PENDING",
      authorName: null,
    });
    const done = await setToothFindingStatus(clinicA.id, caries.id, "DONE");
    expect(done.status).toBe("DONE");
    expect(done.resolvedAt).not.toBeNull();
    const pending = await setToothFindingStatus(clinicA.id, caries.id, "PENDING");
    expect(pending.resolvedAt).toBeNull();
  });

  it("can't touch another clinic's patient or findings", async () => {
    const input = { tooth: "16", surfaces: ["O" as const], condition: "caries", status: "PENDING" as const, authorName: null };
    await expect(addToothFindings(clinicB.id, patientId, input)).rejects.toThrow();
    const [caries] = await addToothFindings(clinicA.id, patientId, input);
    expect(await getToothFindings(clinicB.id, patientId)).toEqual([]);
    await expect(setToothFindingStatus(clinicB.id, caries.id, "DONE")).rejects.toThrow();
    await expect(deleteToothFinding(clinicB.id, caries.id)).rejects.toThrow();
    await deleteToothFinding(clinicA.id, caries.id);
    expect(await getToothFindings(clinicA.id, patientId)).toEqual([]);
  });

  it("is resolved by the consulta that treats it, and goes back to pending if that consulta is deleted", async () => {
    const [caries, other] = await addToothFindings(clinicA.id, patientId, {
      tooth: "16",
      surfaces: ["O", "D"],
      condition: "caries",
      status: "PENDING",
      authorName: null,
    });
    const date = new Date(2026, 9, 1, 10, 0);
    const consultation = await createConsultation(clinicA.id, {
      patientId,
      date,
      treatment: "Obturación (caries)",
      teeth: ["16"],
      resolvedFindingIds: [caries.id],
    });

    let findings = await getToothFindings(clinicA.id, patientId);
    const resolved = findings.find((f) => f.id === caries.id)!;
    expect(resolved.status).toBe("DONE");
    expect(resolved.consultationId).toBe(consultation.id);
    expect(resolved.resolvedAt).toEqual(date);
    expect(findings.find((f) => f.id === other.id)!.status).toBe("PENDING");

    await deleteConsultation(clinicA.id, consultation.id);
    findings = await getToothFindings(clinicA.id, patientId);
    expect(findings.find((f) => f.id === caries.id)).toMatchObject({
      status: "PENDING",
      consultationId: null,
      resolvedAt: null,
    });
  });

  it("doesn't let a consulta resolve another patient's findings", async () => {
    const otherPatient = await createPatient(clinicA.id, { name: "Otro", phone: "2" });
    const [theirs] = await addToothFindings(clinicA.id, otherPatient.id, {
      tooth: "16",
      surfaces: ["O"],
      condition: "caries",
      status: "PENDING",
      authorName: null,
    });
    await createConsultation(clinicA.id, {
      patientId,
      date: new Date(2026, 9, 1),
      treatment: "Limpieza",
      resolvedFindingIds: [theirs.id],
    });
    const [still] = await getToothFindings(clinicA.id, otherPatient.id);
    expect(still.status).toBe("PENDING");
  });
});
