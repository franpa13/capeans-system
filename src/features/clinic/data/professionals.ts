import { prisma } from "@/lib/prisma";
import type { Professional } from "@prisma/client";

import { PROFESSIONAL_TITLES } from "@/features/clinic/data/professional-titles";

export { PROFESSIONAL_TITLES };
const MAX_SIGNATURE_LENGTH = 400_000;

export type ProfessionalInput = {
  title: string;
  name: string;
  specialty?: string | null;
  license: string;
  /** A PNG data URL from the signature pad; null clears it. */
  signature?: string | null;
};

function clean(input: ProfessionalInput) {
  const name = input.name.trim();
  const license = input.license.trim();
  if (!name) throw new Error("Ingresá el nombre");
  if (!license) throw new Error("Ingresá la matrícula");
  if (!(PROFESSIONAL_TITLES as readonly string[]).includes(input.title)) throw new Error("Elegí el título");
  const signature = input.signature || null;
  if (
    signature &&
    (!signature.startsWith("data:image/png;base64,") || signature.length > MAX_SIGNATURE_LENGTH)
  ) {
    throw new Error("La firma no es válida, volvé a dibujarla");
  }
  return { title: input.title, name, license, specialty: input.specialty?.trim() || null, signature };
}

export async function getProfessionals(clinicId: string): Promise<Professional[]> {
  return prisma.professional.findMany({ where: { clinicId }, orderBy: { name: "asc" } });
}

export async function createProfessional(clinicId: string, input: ProfessionalInput): Promise<Professional> {
  return prisma.professional.create({ data: { clinicId, ...clean(input) } });
}

export async function updateProfessional(
  clinicId: string,
  id: string,
  input: ProfessionalInput,
): Promise<Professional> {
  const data = clean(input);
  const result = await prisma.professional.updateMany({ where: { id, clinicId }, data });
  if (result.count === 0) throw new Error("Professional not found for this clinic");
  return prisma.professional.findUniqueOrThrow({ where: { id } });
}

/** What a receta or orden keeps of who signed it, copied in when issued
 * so later edits to the profile don't rewrite it. */
export function signedBy(p: Professional) {
  return {
    professionalTitle: p.title,
    professionalName: p.name,
    professionalSpecialty: p.specialty,
    professionalLicense: p.license,
    professionalSignature: p.signature,
  };
}

/** Their recetas stay, with the name and matrícula copied into them. */
export async function deleteProfessional(clinicId: string, id: string): Promise<void> {
  const result = await prisma.professional.deleteMany({ where: { id, clinicId } });
  if (result.count === 0) throw new Error("Professional not found for this clinic");
}
