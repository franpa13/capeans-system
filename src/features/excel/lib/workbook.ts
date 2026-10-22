import ExcelJS from "exceljs";
import { normalizeHeader, type SheetRow } from "@/features/excel/lib/imports";

export type Column = {
  header: string;
  values: (string | number | Date | null | undefined)[];
  /** Pesos: shown as "$ 15.000" in Excel, still a number to sum. */
  money?: boolean;
  /** A date shown as dd/mm/aaaa. */
  date?: boolean;
};

/** One sheet of a workbook: a bold header row and one column per
 * `columns` entry. */
function addSheet(workbook: ExcelJS.Workbook, sheetName: string, columns: Column[]) {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({
    header: c.header,
    width: Math.max(12, c.header.length + 4),
    style: c.money
      ? { numFmt: '"$" #,##0' }
      : c.date
        ? { numFmt: "dd/mm/yyyy" }
        : {},
  }));
  sheet.getRow(1).font = { bold: true };
  const rowCount = Math.max(0, ...columns.map((c) => c.values.length));
  for (let i = 0; i < rowCount; i++) {
    sheet.addRow(columns.map((c) => c.values[i] ?? null));
  }
  // Widen text columns to fit their content, up to a sane maximum.
  sheet.columns.forEach((column, i) => {
    const longest = Math.max(
      columns[i].header.length,
      ...columns[i].values.map((v) => (v == null ? 0 : String(v).length)),
    );
    column.width = Math.min(50, Math.max(12, longest + 2));
  });
}

/** A workbook with one sheet per entry, in order. */
export async function buildWorkbook(sheets: { name: string; columns: Column[] }[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const s of sheets) addSheet(workbook, s.name, s.columns);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** One sheet — every single-list export and every import template. */
export async function buildXlsx(sheetName: string, columns: Column[]): Promise<Buffer> {
  return buildWorkbook([{ name: sheetName, columns }]);
}

function cellValue(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date || typeof value !== "object") return value;
  // Rich text, hyperlinks and formulas carry the shown value inside.
  if ("richText" in value) return value.richText.map((r) => r.text).join("");
  if ("text" in value && typeof value.text === "string") return value.text;
  if ("result" in value) return value.result;
  return undefined;
}

/** The first sheet's rows under its header row, keyed by normalized header. */
export async function readSheetRows(buffer: Buffer): Promise<SheetRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new Error("No se pudo leer el archivo. Tiene que ser un Excel (.xlsx).");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("El archivo no tiene ninguna hoja.");

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = normalizeHeader(String(cellValue(cell.value) ?? ""));
  });

  const rows: SheetRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, unknown> = {};
    headers.forEach((header, col) => {
      if (header) values[header] = cellValue(row.getCell(col).value);
    });
    rows.push({ rowNumber, values });
  });
  return rows;
}
