import { getCurrentMember } from "@/features/clinic/data/current-member";
import { can } from "@/features/clinic/lib/permissions";
import { isExportKind, parseExportFilters } from "@/features/exports/lib/catalog";
import { buildExport, logExport } from "@/features/exports/data/build-export";
import { xlsxResponse } from "@/features/excel/lib/response";

/** Exportaciones: one kind of the clinic's data as Excel, with the card's
 * filters (desde, hasta, profesional, estado, metodo, tipo). Every
 * download is recorded. (No ".xlsx" in the URL: the proxy skips paths with
 * a dot, and this needs Clerk to know the clinic.) */
export async function GET(request: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  const current = await getCurrentMember();
  if (!current) return new Response("No autorizado", { status: 401 });
  if (!can(current.member.role, "data.export")) return new Response("No tenés permiso", { status: 403 });
  if (!isExportKind(kind)) return new Response("No encontrado", { status: 404 });

  const filters = parseExportFilters(new URL(request.url).searchParams);
  const { buffer, fileName } = await buildExport(current.clinic.id, kind, filters);
  await logExport(current.clinic.id, { kind, memberName: current.member.name, filters });
  return xlsxResponse(buffer, fileName);
}
