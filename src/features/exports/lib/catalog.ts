// Exportaciones: every kind of the clinic's data that can be downloaded
// as Excel, the sheets each file has and the filters it takes.

export type ExportFilterKey =
  | "period"
  | "professional"
  | "patientStatus"
  | "appointmentStatus"
  | "paymentStatus"
  | "paymentMethod"
  | "findingStatus"
  | "orderKind";

export const EXPORTS = [
  {
    kind: "pacientes",
    title: "Pacientes",
    description: "Datos personales, contacto, obra social y saldo; la ficha médica y las observaciones.",
    sheets: ["Pacientes", "Ficha médica", "Observaciones"],
    filters: ["patientStatus"],
  },
  {
    kind: "turnos",
    title: "Turnos",
    description: "Todos los turnos con su paciente, profesional, motivo y estado.",
    sheets: ["Turnos"],
    filters: ["period", "professional", "appointmentStatus"],
  },
  {
    kind: "consultas",
    title: "Consultas y tratamientos",
    description: "Lo realizado a cada paciente, con lo cobrado y lo pendiente, y los insumos usados.",
    sheets: ["Consultas", "Insumos usados"],
    filters: ["period", "professional", "paymentStatus"],
  },
  {
    kind: "pagos",
    title: "Pagos de pacientes",
    description: "Cada pago recibido, con su fecha, medio de pago y la consulta que paga.",
    sheets: ["Pagos"],
    filters: ["period", "paymentMethod"],
  },
  {
    kind: "odontograma",
    title: "Odontograma",
    description: "Los hallazgos de cada paciente por pieza y cara, a realizar o realizados.",
    sheets: ["Hallazgos"],
    filters: ["findingStatus"],
  },
  {
    kind: "recetas",
    title: "Recetas",
    description: "Las recetas emitidas y cada medicamento indicado.",
    sheets: ["Recetas", "Medicamentos"],
    filters: ["period", "professional"],
  },
  {
    kind: "ordenes",
    title: "Órdenes",
    description: "Estudios por imágenes, análisis y derivaciones pedidos.",
    sheets: ["Órdenes", "Pedidos"],
    filters: ["period", "orderKind"],
  },
  {
    kind: "liquidaciones",
    title: "Liquidaciones",
    description: "Las liquidaciones de los profesionales y el detalle de cada una.",
    sheets: ["Liquidaciones", "Detalle"],
    filters: ["professional"],
  },
  {
    kind: "stock",
    title: "Stock",
    description: "Los insumos con su stock actual, y en qué consultas se usaron.",
    sheets: ["Insumos", "Usos"],
    filters: [],
  },
  {
    kind: "estudios",
    title: "Estudios",
    description: "La lista de radiografías, fotos y PDF cargados a cada paciente.",
    sheets: ["Estudios"],
    filters: ["period"],
  },
] as const satisfies readonly {
  kind: string;
  title: string;
  description: string;
  sheets: readonly string[];
  filters: readonly ExportFilterKey[];
}[];

export type ExportKind = (typeof EXPORTS)[number]["kind"];

export function isExportKind(value: string): value is ExportKind {
  return EXPORTS.some((e) => e.kind === value);
}

export type ExportFilters = {
  /** "YYYY-MM-DD", both days included. */
  from?: string;
  to?: string;
  professionalId?: string;
  /** The kind's own status: patients' activos/inactivos, a turno's, a cobro's, a hallazgo's. */
  status?: string;
  method?: string;
  kind?: string;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The filters in a download link (desde, hasta, profesional, estado,
 * metodo, tipo) — empty or malformed ones are left out. */
export function parseExportFilters(params: URLSearchParams): ExportFilters {
  const filters: ExportFilters = {};
  const day = (name: string) => {
    const v = params.get(name);
    return v && DAY.test(v) ? v : undefined;
  };
  const text = (name: string) => params.get(name)?.trim() || undefined;
  const entries: [keyof ExportFilters, string | undefined][] = [
    ["from", day("desde")],
    ["to", day("hasta")],
    ["professionalId", text("profesional")],
    ["status", text("estado")],
    ["method", text("metodo")],
    ["kind", text("tipo")],
  ];
  for (const [key, value] of entries) if (value) filters[key] = value;
  return filters;
}

/** A Prisma date condition for the period: from the start of `from` to the
 * end of `to`. Undefined without dates — the whole history. */
export function periodWhere(filters: Pick<ExportFilters, "from" | "to">): { gte?: Date; lt?: Date } | undefined {
  if (!filters.from && !filters.to) return undefined;
  const range: { gte?: Date; lt?: Date } = {};
  if (filters.from) range.gte = new Date(`${filters.from}T00:00:00`);
  if (filters.to) {
    const end = new Date(`${filters.to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    range.lt = end;
  }
  return range;
}
