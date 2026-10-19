import { describe, expect, it } from "vitest";
import { buildXlsx, readSheetRows } from "@/features/excel/lib/workbook";

describe("workbook", () => {
  it("writes a sheet with headers and reads it back keyed by normalized header", async () => {
    const buffer = await buildXlsx("Pacientes", [
      { header: "Nombre", values: ["Ana", "Beto"] },
      { header: "Teléfono", values: ["11 1111-1111", 1122223333] },
      { header: "Monto", values: [15000, null], money: true },
    ]);
    const rows = await readSheetRows(buffer);
    expect(rows).toEqual([
      { rowNumber: 2, values: { nombre: "Ana", telefono: "11 1111-1111", monto: 15000 } },
      { rowNumber: 3, values: { nombre: "Beto", telefono: 1122223333, monto: undefined } },
    ]);
  });

  it("refuses a file that isn't a valid Excel", async () => {
    await expect(readSheetRows(Buffer.from("hola"))).rejects.toThrow(
      "No se pudo leer el archivo. Tiene que ser un Excel (.xlsx).",
    );
  });
});
