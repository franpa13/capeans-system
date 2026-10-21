import { getCurrentMember } from "@/features/clinic/data/current-member";
import { can } from "@/features/clinic/lib/permissions";
import { getPatientFile, readPatientFile } from "@/features/clinic/data/patient-files";

/** Serves a patient's radiografía/foto/PDF — only to the clinic it
 * belongs to, and to who may see the historia clínica. The type is the one detected on upload (images and PDFs
 * only), and nosniff stops the browser from second-guessing it. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const current = await getCurrentMember();
  if (!current) return new Response("No autorizado", { status: 401 });
  // Radiografías are part of the historia clínica.
  if (!can(current.member.role, "clinical.view")) return new Response("No tenés permiso", { status: 403 });
  const { clinic } = current;
  const file = await getPatientFile(clinic.id, id);
  if (!file) return new Response("No encontrado", { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readPatientFile(file);
  } catch {
    return new Response("El archivo ya no está disponible", { status: 404 });
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
