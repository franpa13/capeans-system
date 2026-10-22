import { prisma } from "@/lib/prisma";
import type { AppointmentStatus, FindingStatus, PaymentMethod, Prisma } from "@prisma/client";
import { buildWorkbook, type Column } from "@/features/excel/lib/workbook";
import { MEDICAL_CONDITIONS } from "@/features/clinic/lib/medical";
import { paymentStatus, PAYMENT_STATUS_LABELS } from "@/features/clinic/lib/billing";
import { PAYMENT_METHOD_LABELS } from "@/features/clinic/lib/payments";
import { APPOINTMENT_STATUS_LABELS } from "@/features/appointments/lib/status";
import { isLowStock } from "@/features/clinic/lib/stock";
import { findingLabel, CONDITIONS, isCondition } from "@/features/clinic/lib/findings";
import { prescriptionNumber, type PrescriptionItem } from "@/features/clinic/lib/prescriptions";
import { ORDER_KINDS, isOrderKind, orderNumber } from "@/features/clinic/lib/orders";
import {
  LIQUIDATION_MODES,
  isLiquidationMode,
  liquidationNumber,
  type LiquidationLine,
} from "@/features/clinic/lib/liquidations";
import { formatDate, toLocalDateString } from "@/features/clinic/lib/format";
import { periodWhere, type ExportFilters, type ExportKind } from "@/features/exports/lib/catalog";

type Sheet = { name: string; columns: Column[] };

/** Excel dates have no time zone: the calendar day the app shows, as UTC
 * midnight, so a 22:00 turno can't land on the next day. */
const localDay = (d: Date | null) => (d ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) : null);
const time = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const conditionLabel = new Map<string, string>(MEDICAL_CONDITIONS.map((c) => [c.value, c.label]));

/** One column per [header, pick] over `rows`. */
function columns<T>(rows: T[], spec: [string, (row: T) => Column["values"][number], ("money" | "date")?][]): Column[] {
  return spec.map(([header, pick, kind]) => ({
    header,
    values: rows.map(pick),
    money: kind === "money",
    date: kind === "date",
  }));
}

async function professionalNames(clinicId: string) {
  const list = await prisma.professional.findMany({ where: { clinicId } });
  const names = new Map(list.map((p) => [p.id, `${p.title} ${p.name}`]));
  return (id: string | null) => (id ? (names.get(id) ?? "") : "");
}

async function patientsSheets(clinicId: string, f: ExportFilters): Promise<Sheet[]> {
  const where: Prisma.PatientWhereInput = {
    clinicId,
    ...(f.status === "activos" ? { active: true } : f.status === "inactivos" ? { active: false } : {}),
  };
  const patients = await prisma.patient.findMany({ where, orderBy: { name: "asc" } });
  const ids = patients.map((p) => p.id);
  const [consultations, notes] = await Promise.all([
    prisma.consultation.findMany({ where: { clinicId, patientId: { in: ids } } }),
    prisma.patientNote.findMany({ where: { clinicId, patientId: { in: ids } }, orderBy: { createdAt: "asc" } }),
  ]);
  const owed = new Map<string, number>();
  for (const c of consultations) {
    if (!c.patientId || c.amountCharged == null) continue;
    owed.set(c.patientId, (owed.get(c.patientId) ?? 0) + Math.max(0, c.amountCharged - c.amountPaid));
  }
  const names = new Map(patients.map((p) => [p.id, p.name]));
  return [
    {
      name: "Pacientes",
      columns: columns(patients, [
        ["Nombre", (p) => p.name],
        ["DNI", (p) => p.dni],
        ["Teléfono", (p) => p.phone],
        ["Email", (p) => p.email],
        ["Fecha de nacimiento", (p) => p.birthDate, "date"],
        ["Género", (p) => p.gender],
        ["Dirección", (p) => p.address],
        ["Ciudad", (p) => p.city],
        ["Provincia", (p) => p.province],
        ["Obra social", (p) => p.insurance],
        ["Plan", (p) => p.insurancePlan],
        ["N° de afiliado", (p) => p.insuranceNumber],
        ["Estado", (p) => (p.active ? "Activo" : "Inactivo")],
        ["Saldo", (p) => owed.get(p.id) ?? 0, "money"],
      ]),
    },
    {
      name: "Ficha médica",
      columns: columns(patients, [
        ["Paciente", (p) => p.name],
        ["Alergias", (p) => p.allergies],
        ["Condiciones", (p) => p.medicalConditions.map((c) => conditionLabel.get(c) ?? c).join(", ") || null],
        ["Medicación habitual", (p) => p.medications],
        ["Antecedentes", (p) => p.medicalHistory],
        ["Grupo sanguíneo", (p) => p.bloodType],
        ["Presión arterial", (p) => p.bloodPressure],
      ]),
    },
    {
      name: "Observaciones",
      columns: columns(notes, [
        ["Paciente", (n) => names.get(n.patientId) ?? ""],
        ["Fecha", (n) => localDay(n.createdAt), "date"],
        ["Observación", (n) => n.text],
        ["Cargó", (n) => n.authorName],
      ]),
    },
  ];
}

async function appointmentsSheets(clinicId: string, f: ExportFilters): Promise<Sheet[]> {
  const pro = await professionalNames(clinicId);
  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId,
      startsAt: periodWhere(f),
      ...(f.professionalId ? { professionalId: f.professionalId } : {}),
      ...(f.status && f.status in APPOINTMENT_STATUS_LABELS ? { status: f.status as AppointmentStatus } : {}),
    },
    include: { patient: { select: { name: true, phone: true } } },
    orderBy: { startsAt: "asc" },
  });
  return [
    {
      name: "Turnos",
      columns: columns(appointments, [
        ["Fecha", (a) => localDay(a.startsAt), "date"],
        ["Hora", (a) => time(a.startsAt)],
        ["Duración (min)", (a) => a.durationMinutes],
        ["Paciente", (a) => a.patient?.name ?? "Sin paciente"],
        ["Teléfono", (a) => a.patient?.phone],
        ["Profesional", (a) => pro(a.professionalId)],
        ["Motivo", (a) => a.reason],
        ["Estado", (a) => APPOINTMENT_STATUS_LABELS[a.status]],
        ["Notas", (a) => a.notes],
        ["Recordatorio enviado", (a) => (a.reminderSentAt ? "Sí" : "No")],
      ]),
    },
  ];
}

async function consultationsSheets(clinicId: string, f: ExportFilters): Promise<Sheet[]> {
  const pro = await professionalNames(clinicId);
  const all = await prisma.consultation.findMany({
    where: {
      clinicId,
      date: periodWhere(f),
      ...(f.professionalId ? { professionalId: f.professionalId } : {}),
    },
    include: {
      patient: { select: { name: true } },
      supplyUsages: { include: { supply: { select: { name: true, unit: true } } } },
    },
    orderBy: { date: "asc" },
  });
  const consultations = f.status
    ? all.filter((c) => paymentStatus(c.amountCharged, c.amountPaid) === f.status)
    : all;
  const usages = consultations.flatMap((c) => c.supplyUsages.map((u) => ({ c, u })));
  return [
    {
      name: "Consultas",
      columns: columns(consultations, [
        ["Fecha", (c) => localDay(c.date), "date"],
        ["Paciente", (c) => c.patient?.name ?? "Paciente eliminado"],
        ["Profesional", (c) => pro(c.professionalId)],
        ["Tratamiento", (c) => c.treatment],
        ["Piezas", (c) => c.teeth.join(", ") || null],
        ["Monto", (c) => c.amountCharged, "money"],
        ["Pagado", (c) => c.amountPaid, "money"],
        ["Saldo", (c) => (c.amountCharged != null ? Math.max(0, c.amountCharged - c.amountPaid) : null), "money"],
        ["Estado del cobro", (c) => PAYMENT_STATUS_LABELS[paymentStatus(c.amountCharged, c.amountPaid)]],
        ["Observaciones", (c) => c.notes],
      ]),
    },
    {
      name: "Insumos usados",
      columns: columns(usages, [
        ["Fecha", ({ c }) => localDay(c.date), "date"],
        ["Paciente", ({ c }) => c.patient?.name ?? "Paciente eliminado"],
        ["Tratamiento", ({ c }) => c.treatment],
        ["Insumo", ({ u }) => u.supply.name],
        ["Cantidad", ({ u }) => u.quantityUsed],
        ["Unidad", ({ u }) => u.supply.unit],
      ]),
    },
  ];
}

async function paymentsSheets(clinicId: string, f: ExportFilters): Promise<Sheet[]> {
  const pro = await professionalNames(clinicId);
  const payments = await prisma.payment.findMany({
    where: {
      clinicId,
      paidAt: periodWhere(f),
      ...(f.method && f.method in PAYMENT_METHOD_LABELS ? { method: f.method as PaymentMethod } : {}),
    },
    include: { consultation: { include: { patient: { select: { name: true } } } } },
    orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
  });
  return [
    {
      name: "Pagos",
      columns: columns(payments, [
        ["Fecha", (p) => localDay(p.paidAt), "date"],
        ["Paciente", (p) => p.consultation.patient?.name ?? "Paciente eliminado"],
        ["Tratamiento", (p) => p.consultation.treatment],
        ["Profesional", (p) => pro(p.consultation.professionalId)],
        ["Medio de pago", (p) => PAYMENT_METHOD_LABELS[p.method]],
        ["Monto", (p) => p.amount, "money"],
      ]),
    },
  ];
}

async function findingsSheets(clinicId: string, f: ExportFilters): Promise<Sheet[]> {
  const findings = await prisma.toothFinding.findMany({
    where: {
      clinicId,
      ...(f.status === "PENDING" || f.status === "DONE" ? { status: f.status as FindingStatus } : {}),
    },
    include: { patient: { select: { name: true } } },
    orderBy: [{ patientId: "asc" }, { tooth: "asc" }, { createdAt: "asc" }],
  });
  return [
    {
      name: "Hallazgos",
      columns: columns(findings, [
        ["Paciente", (x) => x.patient.name],
        ["Pieza", (x) => x.tooth],
        ["Hallazgo", (x) => findingLabel(x)],
        ["Tipo", (x) => (isCondition(x.condition) ? CONDITIONS[x.condition].label : x.condition)],
        ["Estado", (x) => (x.condition === "ausente" ? "Ausente" : x.status === "PENDING" ? "A realizar" : "Realizado")],
        ["Anotado el", (x) => localDay(x.createdAt), "date"],
        ["Realizado el", (x) => localDay(x.resolvedAt), "date"],
        ["Cargó", (x) => x.authorName],
        ["Nota", (x) => x.notes],
      ]),
    },
  ];
}

async function prescriptionsSheets(clinicId: string, f: ExportFilters): Promise<Sheet[]> {
  const prescriptions = await prisma.prescription.findMany({
    where: {
      clinicId,
      date: periodWhere(f),
      ...(f.professionalId ? { professionalId: f.professionalId } : {}),
    },
    include: { patient: { select: { name: true, dni: true } } },
    orderBy: { number: "asc" },
  });
  const items = prescriptions.flatMap((p) =>
    (p.items as unknown as PrescriptionItem[]).map((item) => ({ p, item })),
  );
  return [
    {
      name: "Recetas",
      columns: columns(prescriptions, [
        ["Número", (p) => prescriptionNumber(p.number)],
        ["Fecha", (p) => localDay(p.date), "date"],
        ["Paciente", (p) => p.patient.name],
        ["DNI", (p) => p.patient.dni],
        ["Profesional", (p) => `${p.professionalTitle} ${p.professionalName}`],
        ["Matrícula", (p) => p.professionalLicense],
        ["Tratamiento", (p) => p.treatment],
        ["Indicaciones", (p) => p.instructions],
      ]),
    },
    {
      name: "Medicamentos",
      columns: columns(items, [
        ["Número", ({ p }) => prescriptionNumber(p.number)],
        ["Medicamento", ({ item }) => item.drug],
        ["Concentración", ({ item }) => item.concentration],
        ["Cantidad", ({ item }) => item.quantity],
        ["Indicaciones", ({ item }) => item.instructions],
      ]),
    },
  ];
}

async function ordersSheets(clinicId: string, f: ExportFilters): Promise<Sheet[]> {
  const orders = await prisma.medicalOrder.findMany({
    where: { clinicId, date: periodWhere(f), ...(f.kind && isOrderKind(f.kind) ? { kind: f.kind } : {}) },
    include: { patient: { select: { name: true } } },
    orderBy: { number: "asc" },
  });
  const asked = orders.flatMap((o) => o.items.map((item) => ({ o, item })));
  return [
    {
      name: "Órdenes",
      columns: columns(orders, [
        ["Número", (o) => orderNumber(o.number)],
        ["Fecha", (o) => localDay(o.date), "date"],
        ["Paciente", (o) => o.patient.name],
        ["Profesional", (o) => `${o.professionalTitle} ${o.professionalName}`],
        ["Tipo", (o) => (isOrderKind(o.kind) ? ORDER_KINDS[o.kind].label : o.kind)],
        ["Diagnóstico / motivo", (o) => o.diagnosis],
        ["Observaciones", (o) => o.notes],
      ]),
    },
    {
      name: "Pedidos",
      columns: columns(asked, [
        ["Número", ({ o }) => orderNumber(o.number)],
        ["Pedido", ({ item }) => item],
      ]),
    },
  ];
}

async function liquidationsSheets(clinicId: string, f: ExportFilters): Promise<Sheet[]> {
  const liquidations = await prisma.liquidation.findMany({
    where: { clinicId, ...(f.professionalId ? { professionalId: f.professionalId } : {}) },
    orderBy: { number: "asc" },
  });
  const lastDay = (periodTo: Date) => localDay(new Date(periodTo.getTime() - 24 * 60 * 60 * 1000));
  const lines = liquidations.flatMap((l) => (l.lines as unknown as LiquidationLine[]).map((line) => ({ l, line })));
  return [
    {
      name: "Liquidaciones",
      columns: columns(liquidations, [
        ["Número", (l) => liquidationNumber(l.number)],
        ["Profesional", (l) => l.professionalName],
        ["Desde", (l) => localDay(l.periodFrom), "date"],
        ["Hasta", (l) => lastDay(l.periodTo), "date"],
        ["Modo", (l) => (isLiquidationMode(l.mode) ? LIQUIDATION_MODES[l.mode].label : l.mode)],
        ["Cobrado", (l) => l.totalCollected, "money"],
        ["Comisión", (l) => l.totalCommission, "money"],
        ["Estado", (l) => (l.paidAt ? "Pagada" : "Pendiente de pago")],
        ["Pagada el", (l) => localDay(l.paidAt), "date"],
      ]),
    },
    {
      name: "Detalle",
      columns: columns(lines, [
        ["Número", ({ l }) => liquidationNumber(l.number)],
        ["Fecha", ({ line }) => localDay(new Date(line.date)), "date"],
        ["Paciente", ({ line }) => line.patientName],
        ["Tratamiento", ({ line }) => line.treatment],
        ["Cobrado", ({ line }) => line.collected, "money"],
        ["%", ({ line }) => line.percent],
        ["Comisión", ({ line }) => line.commission, "money"],
      ]),
    },
  ];
}

const STOCK_LABELS = { out: "Sin stock", low: "Stock bajo", ok: "OK" } as const;

async function stockSheets(clinicId: string): Promise<Sheet[]> {
  const [supplies, usages] = await Promise.all([
    prisma.supply.findMany({ where: { clinicId }, orderBy: { name: "asc" } }),
    prisma.consultationSupply.findMany({
      where: { supply: { clinicId } },
      include: {
        supply: { select: { name: true, unit: true } },
        consultation: { select: { date: true, treatment: true, patient: { select: { name: true } } } },
      },
      orderBy: { consultation: { date: "asc" } },
    }),
  ]);
  return [
    {
      name: "Insumos",
      columns: columns(supplies, [
        ["Nombre", (s) => s.name],
        ["Unidad", (s) => s.unit],
        ["Precio", (s) => s.price, "money"],
        ["Stock", (s) => s.quantity],
        ["Avisar cuando queden", (s) => s.lowStockAt],
        ["Estado", (s) => STOCK_LABELS[isLowStock(s.quantity, s.lowStockAt)]],
      ]),
    },
    {
      name: "Usos",
      columns: columns(usages, [
        ["Fecha", (u) => localDay(u.consultation.date), "date"],
        ["Insumo", (u) => u.supply.name],
        ["Cantidad", (u) => u.quantityUsed],
        ["Unidad", (u) => u.supply.unit],
        ["Paciente", (u) => u.consultation.patient?.name ?? "Paciente eliminado"],
        ["Tratamiento", (u) => u.consultation.treatment],
      ]),
    },
  ];
}

async function filesSheets(clinicId: string, f: ExportFilters): Promise<Sheet[]> {
  const files = await prisma.patientFile.findMany({
    where: { clinicId, createdAt: periodWhere(f) },
    include: { patient: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return [
    {
      name: "Estudios",
      columns: columns(files, [
        ["Fecha", (x) => localDay(x.createdAt), "date"],
        ["Paciente", (x) => x.patient.name],
        ["Archivo", (x) => x.fileName],
        ["Tipo", (x) => (x.mimeType === "application/pdf" ? "PDF" : "Imagen")],
        ["Tamaño (KB)", (x) => Math.round(x.size / 1024)],
      ]),
    },
  ];
}

const BUILDERS: Record<ExportKind, (clinicId: string, f: ExportFilters) => Promise<Sheet[]>> = {
  pacientes: patientsSheets,
  turnos: appointmentsSheets,
  consultas: consultationsSheets,
  pagos: paymentsSheets,
  odontograma: findingsSheets,
  recetas: prescriptionsSheets,
  ordenes: ordersSheets,
  liquidaciones: liquidationsSheets,
  stock: stockSheets,
  estudios: filesSheets,
};

/** The Excel of one kind of the clinic's data, with the filters given —
 * only ever this clinic's rows. */
export async function buildExport(clinicId: string, kind: ExportKind, filters: ExportFilters) {
  const sheets = await BUILDERS[kind](clinicId, filters);
  return { buffer: await buildWorkbook(sheets), fileName: `${kind}-${toLocalDateString(new Date())}` };
}

/** "Desde 01/10/2026 · Hasta 31/10/2026 · ..." — or null for everything. */
function describeFilters(f: ExportFilters): string | null {
  const parts = [
    f.from && `Desde ${formatDate(f.from)}`,
    f.to && `Hasta ${formatDate(f.to)}`,
    f.professionalId && "Un profesional",
    f.status && `Estado: ${f.status}`,
    f.method && `Medio: ${f.method}`,
    f.kind && `Tipo: ${f.kind}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** Records who downloaded what: the clinic's data includes patients'
 * health data. */
export async function logExport(
  clinicId: string,
  input: { kind: ExportKind; memberName: string; filters: ExportFilters },
) {
  return prisma.exportLog.create({
    data: { clinicId, kind: input.kind, memberName: input.memberName, filters: describeFilters(input.filters) },
  });
}

export async function getRecentExports(clinicId: string, limit = 10) {
  return prisma.exportLog.findMany({ where: { clinicId }, orderBy: { createdAt: "desc" }, take: limit });
}
