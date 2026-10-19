import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { TEMPLATES, templateXlsx, type TemplateKind } from "@/features/excel/lib/exports";
import { xlsxResponse } from "@/features/excel/lib/response";

/** The empty sheet to fill in for an import ("Descargar plantilla"). */
export async function GET(_request: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!(await getCurrentClinic())) return new Response("No autorizado", { status: 401 });
  if (!(kind in TEMPLATES)) return new Response("No encontrado", { status: 404 });
  return xlsxResponse(await templateXlsx(kind as TemplateKind), `plantilla-${kind}`);
}
