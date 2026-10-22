import { describe, expect, it } from "vitest";
import { EXPORTS, isExportKind, parseExportFilters, periodWhere } from "@/features/exports/lib/catalog";

describe("export catalog", () => {
  it("offers every kind of data, each with its sheets", () => {
    expect(EXPORTS.map((e) => e.kind)).toEqual([
      "pacientes",
      "turnos",
      "consultas",
      "pagos",
      "odontograma",
      "recetas",
      "ordenes",
      "liquidaciones",
      "stock",
      "estudios",
    ]);
    for (const e of EXPORTS) expect(e.sheets.length).toBeGreaterThan(0);
    expect(isExportKind("recetas")).toBe(true);
    expect(isExportKind("usuarios")).toBe(false);
  });

  it("reads the filters from the download link, ignoring empty or malformed ones", () => {
    expect(
      parseExportFilters(
        new URLSearchParams("desde=2026-10-01&hasta=2026-10-31&profesional=p1&estado=NO_SHOW&metodo=&tipo=x"),
      ),
    ).toEqual({ from: "2026-10-01", to: "2026-10-31", professionalId: "p1", status: "NO_SHOW", kind: "x" });
    expect(parseExportFilters(new URLSearchParams("desde=ayer"))).toEqual({});
  });

  it("turns a period into a date range that includes its last day", () => {
    expect(periodWhere({})).toBeUndefined();
    const range = periodWhere({ from: "2026-10-01", to: "2026-10-31" })!;
    expect(range.gte).toEqual(new Date(2026, 9, 1));
    expect(range.lt).toEqual(new Date(2026, 10, 1));
    expect(periodWhere({ to: "2026-10-31" })).toEqual({ lt: new Date(2026, 10, 1) });
  });
});
