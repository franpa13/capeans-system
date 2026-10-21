import { prisma } from "@/lib/prisma";
import type { Clinic } from "@prisma/client";

/** The consultorio's address, phone and email, printed on its recetas. */
export async function updateClinicDetails(
  clinicId: string,
  input: { address?: string; phone?: string; email?: string },
): Promise<Clinic> {
  return prisma.clinic.update({
    where: { id: clinicId },
    data: {
      address: input.address?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
    },
  });
}
