import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import type { Clinic, ClinicMember } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { ensureMember } from "@/features/clinic/data/members";
import { can, type Permission } from "@/features/clinic/lib/permissions";

export const NO_PERMISSION = "No tenés permiso para hacer esto. Pedíselo al administrador del consultorio.";

/** The signed-in person and their consultorio — once per request. Their
 * member row (and so their role) is created the first time they come in. */
export const getCurrentMember = cache(
  async (): Promise<{ clinic: Clinic; member: ClinicMember } | null> => {
    const clinic = await getCurrentClinic();
    if (!clinic) return null;
    const { userId, orgRole } = await auth();
    if (!userId) return null;
    // Known already: no need to ask Clerk who they are on every request.
    const known = await prisma.clinicMember.findUnique({
      where: { clinicId_clerkUserId: { clinicId: clinic.id, clerkUserId: userId } },
    });
    if (known) return { clinic, member: known };
    const user = await currentUser();
    const member = await ensureMember(clinic.id, {
      clerkUserId: userId,
      name: user?.fullName || user?.firstName || "",
      emails: user?.emailAddresses.map((e) => e.emailAddress) ?? [],
      isOrgAdmin: orgRole === "org:admin",
    });
    return { clinic, member };
  },
);

/** For server actions and routes: the clinic's id, if the signed-in person
 * may do this; otherwise an error the screen shows as is. */
export async function requirePermission(permission: Permission): Promise<string> {
  const current = await getCurrentMember();
  if (!current) throw new Error("No hay un consultorio activo para este usuario");
  if (!can(current.member.role, permission)) throw new Error(NO_PERMISSION);
  return current.clinic.id;
}

/** For pages: whether the signed-in person may see this. */
export async function hasPermission(permission: Permission): Promise<boolean> {
  const current = await getCurrentMember();
  return !!current && can(current.member.role, permission);
}
