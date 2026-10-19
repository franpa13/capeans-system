import type { NewPatientInput } from "@/features/clinic/data/patients";
import type { NewSupplyInput } from "@/features/clinic/data/supplies";

/** One spreadsheet row below the header, keyed by normalized header. */
export type SheetRow = { rowNumber: number; values: Record<string, unknown> };
export type RowError = { row: number; message: string };
export type ParsedRows<T> = { items: { rowNumber: number; input: T }[]; errors: RowError[] };

/** "Teléfono" → "telefono", "N° de afiliado" → "ndeafiliado": headers are
 * matched loosely, so a hand-made sheet doesn't have to match exactly. */
export function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** The first non-empty value among the accepted names for a column. */
function pick(row: SheetRow, ...names: string[]): unknown {
  for (const name of names) {
    const value = row.values[normalizeHeader(name)];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return undefined;
}

function text(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (value instanceof Date) return value.toLocaleDateString("es-AR");
  const s = String(value).trim();
  return s === "" ? undefined : s;
}

class RowProblem extends Error {}

/** A whole, non-negative number — "4.500" is refused like in the forms,
 * because Number("4.500") would silently read it as 4.5 or 4. */
function wholeNumber(value: unknown, column: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  const s = String(value).trim();
  if (/^\d+$/.test(s)) return Number(s);
  throw new RowProblem(`${column}: tiene que ser un número entero, sin puntos ni comas`);
}

/** A birth date as UTC midnight of that day — how the patient form's
 * date input stores it. Excel date cells come back as UTC midnight too. */
function date(value: unknown): Date | undefined {
  if (value === undefined) return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const match = String(value).trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [, d, m, y] = match.map(Number);
    const parsed = new Date(Date.UTC(y, m - 1, d));
    if (parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d) return parsed;
  }
  throw new RowProblem("La fecha de nacimiento no es válida (usá dd/mm/aaaa)");
}

function isBlank(row: SheetRow) {
  return Object.values(row.values).every((v) => v === undefined || v === null || String(v).trim() === "");
}

function parseRows<T>(rows: SheetRow[], parse: (row: SheetRow) => T): ParsedRows<T> {
  const result: ParsedRows<T> = { items: [], errors: [] };
  for (const row of rows) {
    if (isBlank(row)) continue;
    try {
      result.items.push({ rowNumber: row.rowNumber, input: parse(row) });
    } catch (error) {
      if (!(error instanceof RowProblem)) throw error;
      result.errors.push({ row: row.rowNumber, message: error.message });
    }
  }
  return result;
}

export const PATIENT_COLUMNS = [
  "Nombre",
  "Teléfono",
  "Email",
  "DNI",
  "Fecha de nacimiento",
  "Dirección",
  "Obra social",
  "N° de afiliado",
  "Alergias",
  "Medicación habitual",
];

export function parsePatientRows(rows: SheetRow[]): ParsedRows<NewPatientInput> {
  return parseRows(rows, (row) => {
    const name = text(pick(row, "Nombre", "Nombre y apellido", "Paciente"));
    const phone = text(pick(row, "Teléfono", "Telefono", "Celular"));
    if (!name) throw new RowProblem("Falta el nombre");
    if (!phone) throw new RowProblem("Falta el teléfono");
    return {
      name,
      phone,
      email: text(pick(row, "Email", "Mail", "Correo")),
      dni: text(pick(row, "DNI", "Documento")),
      birthDate: date(pick(row, "Fecha de nacimiento", "Nacimiento")),
      address: text(pick(row, "Dirección", "Domicilio")),
      insurance: text(pick(row, "Obra social", "Prepaga")),
      insuranceNumber: text(pick(row, "N° de afiliado", "Número de afiliado", "Afiliado")),
      allergies: text(pick(row, "Alergias")),
      medications: text(pick(row, "Medicación habitual", "Medicación", "Medicacion")),
    };
  });
}

export const SUPPLY_COLUMNS = ["Nombre", "Unidad", "Precio", "Stock", "Avisar cuando queden"];

export function parseSupplyRows(rows: SheetRow[]): ParsedRows<NewSupplyInput> {
  return parseRows(rows, (row) => {
    const name = text(pick(row, "Nombre", "Insumo"));
    const unit = text(pick(row, "Unidad"));
    if (!name) throw new RowProblem("Falta el nombre");
    if (!unit) throw new RowProblem("Falta la unidad");
    return {
      name,
      unit,
      price: wholeNumber(pick(row, "Precio"), "Precio"),
      quantity: wholeNumber(pick(row, "Stock", "Cantidad", "Stock inicial"), "Stock"),
      lowStockAt: wholeNumber(pick(row, "Avisar cuando queden", "Stock mínimo"), "Avisar cuando queden"),
    };
  });
}

export const TREATMENT_COLUMNS = ["Nombre", "Precio"];

export function parseTreatmentRows(
  rows: SheetRow[],
): ParsedRows<{ label: string; price: number | undefined }> {
  return parseRows(rows, (row) => {
    const label = text(pick(row, "Nombre", "Tratamiento"));
    if (!label) throw new RowProblem("Falta el nombre");
    return { label, price: wholeNumber(pick(row, "Precio"), "Precio") };
  });
}
