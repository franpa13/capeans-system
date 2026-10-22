import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { createPatient } from "@/features/clinic/data/patients";
import { createProfessional } from "@/features/clinic/data/professionals";
import { createAppointment } from "@/features/clinic/data/appointments";
import { createPrescription } from "@/features/clinic/data/prescriptions";
import { addPatientNote } from "@/features/clinic/data/patient-notes";
import { buildExport, getRecentExports, logExport } from "@/features/exports/data/build-export";

let clinicA: { id: string };
let clinicB: { id: string };

beforeEach(async () => {
  clinicA = await prisma.clinic.create({ data: { clerkOrgId: `org_a_${Date.now()}`, name: "Clínica A" } });
  clinicB = await prisma.clinic.create({ data: { clerkOrgId: `org_b_${Date.now()}`, name: "Clínica B" } });
});

afterEach(async () => {
  await prisma.exportLog.deleteMany({});
  await prisma.prescription.deleteMany({});
  await prisma.appointment.deleteMany({});
  await prisma.professional.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.clinic.deleteMany({});
});

/** The workbook's sheets, each as its rows of cell texts (header first). */
async function read(buffer: Buffer) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheets: Record<string, string[][]> = {};
  book.eachSheet((sheet) => {
    const rows: string[][] = [];
    sheet.eachRow((row) => rows.push((row.values as unknown[]).slice(1).map((v) => (v == null ? "" : String(v)))));
    sheets[sheet.name] = rows;
  });
  return sheets;
}

describe("buildExport", () => {
  it("exports patients in three sheets, only this clinic's, filtered by activos/inactivos", async () => {
    const ana = await createPatient(clinicA.id, { name: "Ana Gómez", phone: "1", allergies: "Penicilina" });
    await createPatient(clinicA.id, { name: "Beto Inactivo", phone: "2", active: false });
    await createPatient(clinicB.id, { name: "De Otra Clínica", phone: "3" });
    await addPatientNote(clinicA.id, ana.id, { text: "Prefiere la tarde", authorName: "Dra. Paz" });

    const all = await read((await buildExport(clinicA.id, "pacientes", {})).buffer);
    expect(Object.keys(all)).toEqual(["Pacientes", "Ficha médica", "Observaciones"]);
    expect(all["Pacientes"].slice(1).map((r) => r[0]).sort()).toEqual(["Ana Gómez", "Beto Inactivo"]);
    expect(all["Ficha médica"].find((r) => r[0] === "Ana Gómez")).toContain("Penicilina");
    expect(all["Observaciones"][1]).toEqual(expect.arrayContaining(["Ana Gómez", "Prefiere la tarde", "Dra. Paz"]));

    const active = await read((await buildExport(clinicA.id, "pacientes", { status: "activos" })).buffer);
    expect(active["Pacientes"].slice(1).map((r) => r[0])).toEqual(["Ana Gómez"]);
  });

  it("exports turnos within the period and of one professional", async () => {
    const pro = await createProfessional(clinicA.id, { title: "Dra.", name: "Moretti", license: "1" });
    const patient = await createPatient(clinicA.id, { name: "Ana Gómez", phone: "1" });
    await createAppointment(clinicA.id, { patientId: patient.id, startsAt: new Date(2026, 9, 10, 10), professionalId: pro.id });
    await createAppointment(clinicA.id, { patientId: patient.id, startsAt: new Date(2026, 9, 31, 18), reason: "Último día" });
    await createAppointment(clinicA.id, { patientId: patient.id, startsAt: new Date(2026, 10, 1, 10) });

    const october = await read(
      (await buildExport(clinicA.id, "turnos", { from: "2026-10-01", to: "2026-10-31" })).buffer,
    );
    expect(october["Turnos"].length - 1).toBe(2);
    const hers = await read((await buildExport(clinicA.id, "turnos", { professionalId: pro.id })).buffer);
    expect(hers["Turnos"].slice(1).map((r) => r.join(" "))).toEqual([expect.stringContaining("Dra. Moretti")]);
  });

  it("exports recetas with one row per medication", async () => {
    const pro = await createProfessional(clinicA.id, { title: "Dra.", name: "Moretti", license: "1" });
    const patient = await createPatient(clinicA.id, { name: "Ana Gómez", phone: "1" });
    await createPrescription(clinicA.id, patient.id, {
      professionalId: pro.id,
      items: [
        { drug: "Amoxicilina", concentration: "500 mg", quantity: "21", instructions: "1 cada 8 h" },
        { drug: "Ibuprofeno", concentration: "400 mg", quantity: "12", instructions: "Si hay dolor" },
      ],
    });
    const sheets = await read((await buildExport(clinicA.id, "recetas", {})).buffer);
    expect(sheets["Recetas"].length - 1).toBe(1);
    expect(sheets["Medicamentos"].slice(1).map((r) => r[1])).toEqual(["Amoxicilina", "Ibuprofeno"]);
  });

  it("names the file after the kind and the day", async () => {
    const { fileName } = await buildExport(clinicA.id, "stock", {});
    expect(fileName).toMatch(/^stock-\d{4}-\d{2}-\d{2}$/);
  });
});

describe("export log", () => {
  it("records each download and lists the latest first, per clinic", async () => {
    await logExport(clinicA.id, { kind: "pacientes", memberName: "Dra. Paz", filters: {} });
    await new Promise((r) => setTimeout(r, 5));
    await logExport(clinicA.id, { kind: "turnos", memberName: "Dra. Paz", filters: { from: "2026-10-01", to: "2026-10-31" } });
    const recent = await getRecentExports(clinicA.id);
    expect(recent.map((l) => [l.kind, l.filters])).toEqual([
      ["turnos", "Desde 01/10/2026 · Hasta 31/10/2026"],
      ["pacientes", null],
    ]);
    expect(await getRecentExports(clinicB.id)).toEqual([]);
  });
});
