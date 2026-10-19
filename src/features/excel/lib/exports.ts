import type { Consultation, Patient, Supply } from "@prisma/client";
import type { PaymentWithConsultation } from "@/features/clinic/data/payments";
import { buildXlsx } from "@/features/excel/lib/workbook";
import {
  PATIENT_COLUMNS,
  SUPPLY_COLUMNS,
  TREATMENT_COLUMNS,
} from "@/features/excel/lib/imports";
import { MEDICAL_CONDITIONS } from "@/features/clinic/lib/medical";
import { paymentStatus, PAYMENT_STATUS_LABELS } from "@/features/clinic/lib/billing";
import { PAYMENT_METHOD_LABELS } from "@/features/clinic/lib/payments";
import { isLowStock } from "@/features/clinic/lib/stock";

/** Excel dates have no time zone: write the calendar day the app shows,
 * as UTC midnight, so a 22:00 consulta can't land on the next day. */
const localDay = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
/** Birth dates are stored as UTC midnight (from a date input) already. */
const utcDay = (d: Date | null) => d;

const conditionLabel = new Map<string, string>(MEDICAL_CONDITIONS.map((c) => [c.value, c.label]));

/** Same columns, in the same order, as the import template — so a
 * downloaded list can be edited and imported back. */
export function patientsXlsx(patients: Patient[]) {
  const col = <T,>(pick: (p: Patient) => T) => patients.map(pick);
  return buildXlsx("Pacientes", [
    { header: "Nombre", values: col((p) => p.name) },
    { header: "Teléfono", values: col((p) => p.phone) },
    { header: "Email", values: col((p) => p.email) },
    { header: "DNI", values: col((p) => p.dni) },
    { header: "Fecha de nacimiento", values: col((p) => utcDay(p.birthDate)), date: true },
    { header: "Dirección", values: col((p) => p.address) },
    { header: "Obra social", values: col((p) => p.insurance) },
    { header: "N° de afiliado", values: col((p) => p.insuranceNumber) },
    { header: "Alergias", values: col((p) => p.allergies) },
    { header: "Medicación habitual", values: col((p) => p.medications) },
    {
      header: "Antecedentes",
      values: col((p) => p.medicalConditions.map((c) => conditionLabel.get(c) ?? c).join(", ") || null),
    },
  ]);
}

export function consultationsXlsx(consultations: Consultation[], patientNames: Map<string, string>) {
  const col = <T,>(pick: (c: Consultation) => T) => consultations.map(pick);
  return buildXlsx("Consultas", [
    { header: "Fecha", values: col((c) => localDay(c.date)), date: true },
    {
      header: "Paciente",
      values: col((c) => (c.patientId ? (patientNames.get(c.patientId) ?? "") : "Paciente eliminado")),
    },
    { header: "Tratamiento", values: col((c) => c.treatment) },
    { header: "Dientes", values: col((c) => c.teeth.join(", ") || null) },
    { header: "Monto", values: col((c) => c.amountCharged), money: true },
    { header: "Pagado", values: col((c) => c.amountPaid), money: true },
    {
      header: "Saldo",
      values: col((c) => (c.amountCharged != null ? Math.max(0, c.amountCharged - c.amountPaid) : null)),
      money: true,
    },
    {
      header: "Estado del cobro",
      values: col((c) => PAYMENT_STATUS_LABELS[paymentStatus(c.amountCharged, c.amountPaid)]),
    },
    { header: "Observaciones", values: col((c) => c.notes) },
  ]);
}

export function paymentsXlsx(payments: PaymentWithConsultation[]) {
  const col = <T,>(pick: (p: PaymentWithConsultation) => T) => payments.map(pick);
  return buildXlsx("Ingresos", [
    { header: "Fecha", values: col((p) => localDay(p.paidAt)), date: true },
    { header: "Paciente", values: col((p) => p.consultation.patient?.name ?? "Paciente eliminado") },
    { header: "Tratamiento", values: col((p) => p.consultation.treatment) },
    { header: "Medio de pago", values: col((p) => PAYMENT_METHOD_LABELS[p.method]) },
    { header: "Monto", values: col((p) => p.amount), money: true },
  ]);
}

const STOCK_LABELS = { out: "Sin stock", low: "Stock bajo", ok: "OK" } as const;

export function suppliesXlsx(supplies: Supply[]) {
  const col = <T,>(pick: (s: Supply) => T) => supplies.map(pick);
  return buildXlsx("Stock", [
    { header: "Nombre", values: col((s) => s.name) },
    { header: "Unidad", values: col((s) => s.unit) },
    { header: "Precio", values: col((s) => s.price), money: true },
    { header: "Stock", values: col((s) => s.quantity) },
    { header: "Avisar cuando queden", values: col((s) => s.lowStockAt) },
    { header: "Estado", values: col((s) => STOCK_LABELS[isLowStock(s.quantity, s.lowStockAt)]) },
  ]);
}

export const TEMPLATES = {
  pacientes: { sheet: "Pacientes", columns: PATIENT_COLUMNS },
  insumos: { sheet: "Insumos", columns: SUPPLY_COLUMNS },
  tratamientos: { sheet: "Tratamientos", columns: TREATMENT_COLUMNS },
} as const;
export type TemplateKind = keyof typeof TEMPLATES;

/** An empty sheet with the import's headers, to fill in and import. */
export function templateXlsx(kind: TemplateKind) {
  const { sheet, columns } = TEMPLATES[kind];
  return buildXlsx(
    sheet,
    columns.map((header) => ({ header, values: [] })),
  );
}
