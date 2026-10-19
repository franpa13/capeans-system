import { describe, expect, it } from "vitest";
import type { Consultation, Patient, Supply } from "@prisma/client";
import {
  consultationsXlsx,
  patientsXlsx,
  suppliesXlsx,
  templateXlsx,
} from "@/features/excel/lib/exports";
import { parsePatientRows } from "@/features/excel/lib/imports";
import { readSheetRows } from "@/features/excel/lib/workbook";

const patient = {
  id: "p1",
  name: "Ana Gómez",
  phone: "11 1111-1111",
  email: null,
  dni: "30123456",
  birthDate: new Date(Date.UTC(1990, 4, 3)),
  address: null,
  insurance: "OSDE",
  insuranceNumber: "123/01",
  allergies: "penicilina",
  medicalConditions: ["anticoagulantes", "diabetes"],
  medications: null,
} as Patient;

describe("exports", () => {
  it("a patients export can be imported back as is", async () => {
    const rows = await readSheetRows(await patientsXlsx([patient]));
    expect(rows[0].values.antecedentes).toBe("Toma anticoagulantes, Diabetes");
    const parsed = parsePatientRows(rows);
    expect(parsed.errors).toEqual([]);
    expect(parsed.items[0].input).toMatchObject({
      name: "Ana Gómez",
      dni: "30123456",
      insuranceNumber: "123/01",
      birthDate: new Date(Date.UTC(1990, 4, 3)),
    });
  });

  it("lists consultas with patient, amounts, balance and payment status", async () => {
    const consultation = {
      id: "c1",
      patientId: "p1",
      date: new Date(2026, 9, 1, 10, 0),
      treatment: "Ortodoncia",
      teeth: ["11", "21"],
      notes: null,
      amountCharged: 30000,
      amountPaid: 10000,
    } as Consultation;
    const [row] = await readSheetRows(
      await consultationsXlsx([consultation], new Map([["p1", "Ana Gómez"]])),
    );
    expect(row.values).toMatchObject({
      paciente: "Ana Gómez",
      tratamiento: "Ortodoncia",
      dientes: "11, 21",
      monto: 30000,
      pagado: 10000,
      saldo: 20000,
      estadodelcobro: "Parcial",
    });
  });

  it("marks low stock in words", async () => {
    const supply = { name: "Guantes", unit: "caja", price: 4500, quantity: 1, lowStockAt: 2 } as Supply;
    const [row] = await readSheetRows(await suppliesXlsx([supply]));
    expect(row.values).toMatchObject({ nombre: "Guantes", stock: 1, estado: "Stock bajo" });
  });

  it("a template has just the import's headers", async () => {
    const buffer = await templateXlsx("insumos");
    expect(await readSheetRows(buffer)).toEqual([]);
  });
});
