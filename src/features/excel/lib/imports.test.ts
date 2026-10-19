import { describe, expect, it } from "vitest";
import {
  normalizeHeader,
  parsePatientRows,
  parseSupplyRows,
  parseTreatmentRows,
  type SheetRow,
} from "@/features/excel/lib/imports";

function rows(...items: Record<string, unknown>[]): SheetRow[] {
  return items.map((values, i) => ({
    rowNumber: i + 2,
    values: Object.fromEntries(Object.entries(values).map(([k, v]) => [normalizeHeader(k), v])),
  }));
}

describe("normalizeHeader", () => {
  it("ignores case, accents, spaces and symbols", () => {
    expect(normalizeHeader("  Teléfono ")).toBe("telefono");
    expect(normalizeHeader("N° de afiliado")).toBe("ndeafiliado");
    expect(normalizeHeader("Fecha de Nacimiento")).toBe("fechadenacimiento");
  });
});

describe("parsePatientRows", () => {
  it("reads every column of the template, accepting number cells for phone and DNI", () => {
    const result = parsePatientRows(
      rows({
        Nombre: "Ana Gómez",
        Teléfono: 1133334444,
        Email: "ana@mail.com",
        DNI: 30123456,
        "Fecha de nacimiento": new Date(Date.UTC(1990, 4, 3)),
        Dirección: "Calle 1",
        "Obra social": "OSDE",
        "N° de afiliado": "123/01",
        Alergias: "penicilina",
        "Medicación habitual": "Enalapril",
      }),
    );
    expect(result.errors).toEqual([]);
    expect(result.items).toEqual([
      {
        rowNumber: 2,
        input: {
          name: "Ana Gómez",
          phone: "1133334444",
          email: "ana@mail.com",
          dni: "30123456",
          birthDate: new Date(Date.UTC(1990, 4, 3)),
          address: "Calle 1",
          insurance: "OSDE",
          insuranceNumber: "123/01",
          allergies: "penicilina",
          medications: "Enalapril",
        },
      },
    ]);
  });

  it("reads a dd/mm/yyyy birth date typed as text", () => {
    const result = parsePatientRows(rows({ Nombre: "Ana", Teléfono: "1", "Fecha de nacimiento": "03/05/1990" }));
    expect(result.items[0].input.birthDate).toEqual(new Date(Date.UTC(1990, 4, 3)));
  });

  it("reports, by row number, a row missing the name or the phone, and skips blank rows", () => {
    const result = parsePatientRows(
      rows({ Nombre: "Ana", Teléfono: "" }, { Nombre: "", Teléfono: "" }, { Nombre: "", Teléfono: "11" }),
    );
    expect(result.items).toEqual([]);
    expect(result.errors).toEqual([
      { row: 2, message: "Falta el teléfono" },
      { row: 4, message: "Falta el nombre" },
    ]);
  });

  it("reports an invalid birth date instead of guessing", () => {
    const result = parsePatientRows(rows({ Nombre: "Ana", Teléfono: "1", "Fecha de nacimiento": "ayer" }));
    expect(result.errors).toEqual([
      { row: 2, message: "La fecha de nacimiento no es válida (usá dd/mm/aaaa)" },
    ]);
  });
});

describe("parseSupplyRows", () => {
  it("reads name, unit, price, stock and threshold", () => {
    const result = parseSupplyRows(
      rows({ Nombre: "Guantes", Unidad: "caja", Precio: 4500, Stock: "10", "Avisar cuando queden": 2 }),
    );
    expect(result.errors).toEqual([]);
    expect(result.items[0].input).toEqual({
      name: "Guantes",
      unit: "caja",
      price: 4500,
      quantity: 10,
      lowStockAt: 2,
    });
  });

  it("rejects a number typed with a thousands separator, like the forms do", () => {
    const result = parseSupplyRows(rows({ Nombre: "Guantes", Unidad: "caja", Precio: "4.500" }));
    expect(result.errors).toEqual([
      { row: 2, message: "Precio: tiene que ser un número entero, sin puntos ni comas" },
    ]);
  });

  it("requires a unit", () => {
    expect(parseSupplyRows(rows({ Nombre: "Guantes" })).errors).toEqual([
      { row: 2, message: "Falta la unidad" },
    ]);
  });
});

describe("parseTreatmentRows", () => {
  it("reads the name and an optional price", () => {
    const result = parseTreatmentRows(rows({ Nombre: "Limpieza", Precio: 15000 }, { Nombre: "Control" }));
    expect(result.items.map((i) => i.input)).toEqual([
      { label: "Limpieza", price: 15000 },
      { label: "Control", price: undefined },
    ]);
  });
});
