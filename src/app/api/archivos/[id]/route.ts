import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { getPatientFile, readPatientFile } from "@/features/clinic/data/patient-files";

/** Serves a patient's radiografía/foto/PDF — only to the clinic it
 * belongs to. The type is the one detected on upload (images and PDFs
 * only), and nosniff stops the browser from second-guessing it. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const clinic = await getCurrentClinic();
  if (!clinic) return new Response("No autorizado", { status: 401 });
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
