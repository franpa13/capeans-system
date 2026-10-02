import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { Clinic } from "@prisma/client";

export async function getCurrentClinic(): Promise<Clinic | null> {
  const { orgId } = await auth();
  if (!orgId) return null;

  return prisma.clinic.findUnique({ where: { clerkOrgId: orgId } });
}

export function getDashboardAccessMessage(orgId: string | null | undefined): string {
  if (!orgId) {
    return "Tu cuenta todavía no está asociada a ningún consultorio. Contactá al administrador para que te invite.";
  }
  return "Todavía estamos configurando tu consultorio, probá de nuevo en un minuto.";
}
