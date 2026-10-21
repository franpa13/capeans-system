import { prisma } from "@/lib/prisma";
import type { ClinicInvitation, ClinicMember, MemberRole } from "@prisma/client";
import { resolveNewMemberRole } from "@/features/clinic/lib/permissions";

const LAST_ADMIN = "Tiene que quedar al menos un administrador";

/** The signed-in person as a member of this consultorio — created the
 * first time they come in, with the role of their invitation (which is
 * then used up), or as resolveNewMemberRole decides. */
export async function ensureMember(
  clinicId: string,
  user: { clerkUserId: string; name: string; emails: string[]; isOrgAdmin: boolean },
): Promise<ClinicMember> {
  const existing = await prisma.clinicMember.findUnique({
    where: { clinicId_clerkUserId: { clinicId, clerkUserId: user.clerkUserId } },
  });
  if (existing) return existing;

  const emails = user.emails.map((e) => e.trim().toLowerCase());
  return prisma.$transaction(async (tx) => {
    const invitation = await tx.clinicInvitation.findFirst({ where: { clinicId, email: { in: emails } } });
    const clinicHasMembers = (await tx.clinicMember.count({ where: { clinicId } })) > 0;
    const role = resolveNewMemberRole({
      invitedAs: invitation?.role ?? null,
      clinicHasMembers,
      isOrgAdmin: user.isOrgAdmin,
    });
    if (invitation) await tx.clinicInvitation.delete({ where: { id: invitation.id } });
    return tx.clinicMember.upsert({
      where: { clinicId_clerkUserId: { clinicId, clerkUserId: user.clerkUserId } },
      update: {},
      create: {
        clinicId,
        clerkUserId: user.clerkUserId,
        role,
        name: user.name.trim() || emails[0] || "Sin nombre",
        email: invitation?.email ?? emails[0] ?? "",
      },
    });
  });
}

export async function getMembers(clinicId: string): Promise<ClinicMember[]> {
  return prisma.clinicMember.findMany({ where: { clinicId }, orderBy: { createdAt: "asc" } });
}

async function findMember(clinicId: string, id: string) {
  const member = await prisma.clinicMember.findFirst({ where: { id, clinicId } });
  if (!member) throw new Error("Member not found for this clinic");
  return member;
}

async function assertAnotherAdmin(clinicId: string, memberId: string) {
  const others = await prisma.clinicMember.count({ where: { clinicId, role: "ADMIN", id: { not: memberId } } });
  if (others === 0) throw new Error(LAST_ADMIN);
}

export async function setMemberRole(clinicId: string, id: string, role: MemberRole): Promise<ClinicMember> {
  const member = await findMember(clinicId, id);
  if (member.role === "ADMIN" && role !== "ADMIN") await assertAnotherAdmin(clinicId, id);
  return prisma.clinicMember.update({ where: { id }, data: { role } });
}

/** Takes someone off the team; returns them so their Clerk membership can
 * go too. */
export async function removeMember(clinicId: string, id: string): Promise<ClinicMember> {
  const member = await findMember(clinicId, id);
  if (member.role === "ADMIN") await assertAnotherAdmin(clinicId, id);
  await prisma.clinicMember.delete({ where: { id } });
  return member;
}

/** Someone in Clerk left the organization: off the team here too. */
export async function removeMemberByClerkUser(clinicId: string, clerkUserId: string): Promise<void> {
  await prisma.clinicMember.deleteMany({ where: { clinicId, clerkUserId } });
}

export async function createInvitation(
  clinicId: string,
  input: { email: string; role: MemberRole },
): Promise<ClinicInvitation> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Ingresá un email válido");
  const member = await prisma.clinicMember.findFirst({ where: { clinicId, email } });
  if (member) throw new Error("Esa persona ya es parte del equipo");
  return prisma.clinicInvitation.upsert({
    where: { clinicId_email: { clinicId, email } },
    update: { role: input.role },
    create: { clinicId, email, role: input.role },
  });
}

export async function setInvitationClerkId(id: string, clerkInvitationId: string): Promise<void> {
  await prisma.clinicInvitation.update({ where: { id }, data: { clerkInvitationId } });
}

export async function getInvitations(clinicId: string): Promise<ClinicInvitation[]> {
  return prisma.clinicInvitation.findMany({ where: { clinicId }, orderBy: { createdAt: "asc" } });
}

/** Cancels an invitation; returns it so Clerk's can be revoked too. */
export async function deleteInvitation(clinicId: string, id: string): Promise<ClinicInvitation> {
  const invitation = await prisma.clinicInvitation.findFirst({ where: { id, clinicId } });
  if (!invitation) throw new Error("Invitation not found for this clinic");
  await prisma.clinicInvitation.delete({ where: { id } });
  return invitation;
}
