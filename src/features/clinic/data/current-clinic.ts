import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { Clinic } from "@prisma/client";

export async function getCurrentClinic(): Promise<Clinic | null> {
  const { orgId } = await auth();
  if (!orgId) return null;

  return prisma.clinic.findUnique({ where: { clerkOrgId: orgId } });
}
