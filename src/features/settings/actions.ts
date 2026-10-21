"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { getCurrentMember, requirePermission } from "@/features/clinic/data/current-member";
import {
  createInvitation,
  deleteInvitation,
  removeMember,
  setInvitationClerkId,
  setMemberProfessional,
  setMemberRole,
} from "@/features/clinic/data/members";
import type { MemberRole } from "@/features/clinic/lib/permissions";
import { runAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import {
  createClinicOption,
  createTreatment,
  deleteClinicOption,
  updateClinicOption,
  updateTreatment,
  type OptionCategory,
  type TreatmentInput,
} from "@/features/clinic/data/clinic-options";
import {
  createProfessional,
  deleteProfessional,
  updateProfessional,
  type ProfessionalInput,
} from "@/features/clinic/data/professionals";
import { updateClinicDetails } from "@/features/clinic/data/clinic-details";
import {
  upsertBusinessHours,
  type BusinessHoursInput,
} from "@/features/clinic/data/business-hours";


export async function createClinicOptionAction(
  category: OptionCategory,
  label: string,
  price?: number,
) {
  return runAction(async () => {
    const clinicId = await requirePermission("settings.manage");
    const option = await createClinicOption(clinicId, category, label, price);
    revalidatePath("/dashboard/configuracion");
    return option;
  });
}

export async function updateClinicOptionAction(id: string, label: string, price?: number) {
  return runAction(async () => {
    const clinicId = await requirePermission("settings.manage");
    const option = await updateClinicOption(clinicId, id, label, price);
    revalidatePath("/dashboard/configuracion");
    return option;
  });
}

export async function deleteClinicOptionAction(id: string) {
  return runAction(async () => {
    const clinicId = await requirePermission("settings.manage");
    await deleteClinicOption(clinicId, id);
    revalidatePath("/dashboard/configuracion");
  });
}

export async function updateBusinessHoursAction(weekday: number, input: BusinessHoursInput) {
  return runAction(async () => {
    const clinicId = await requirePermission("settings.manage");
    const hours = await upsertBusinessHours(clinicId, weekday, input);
    revalidatePath("/dashboard/configuracion");
    // The Turnos grid reads business hours too, to shade closed hours.
    revalidatePath("/dashboard/turnos");
    return hours;
  });
}

export async function createTreatmentAction(input: TreatmentInput) {
  return runAction(async () => {
    const clinicId = await requirePermission("settings.manage");
    const treatment = await createTreatment(clinicId, input);
    revalidatePath("/dashboard/configuracion");
    return treatment;
  });
}

export async function updateTreatmentAction(id: string, input: TreatmentInput) {
  return runAction(async () => {
    const clinicId = await requirePermission("settings.manage");
    const treatment = await updateTreatment(clinicId, id, input);
    revalidatePath("/dashboard/configuracion");
    return treatment;
  });
}

export async function createProfessionalAction(input: ProfessionalInput) {
  return runAction(async () => {
    const clinicId = await requirePermission("settings.manage");
    await createProfessional(clinicId, input);
    revalidatePath("/dashboard/configuracion");
  });
}

export async function updateProfessionalAction(id: string, input: ProfessionalInput) {
  return runAction(async () => {
    const clinicId = await requirePermission("settings.manage");
    await updateProfessional(clinicId, id, input);
    revalidatePath("/dashboard/configuracion");
  });
}

export async function deleteProfessionalAction(id: string) {
  return runAction(async () => {
    const clinicId = await requirePermission("settings.manage");
    await deleteProfessional(clinicId, id);
    revalidatePath("/dashboard/configuracion");
  });
}

export async function updateClinicDetailsAction(input: { address?: string; phone?: string; email?: string }) {
  return runAction(async () => {
    const clinicId = await requirePermission("settings.manage");
    await updateClinicDetails(clinicId, input);
    revalidatePath("/dashboard/configuracion");
  });
}

/** The consultorio's Clerk organization, for the team actions. */
async function requireTeamAdmin() {
  const clinicId = await requirePermission("team.manage");
  const current = (await getCurrentMember())!;
  return { clinicId, organizationId: current.clinic.clerkOrgId, me: current.member };
}

/** Invites someone by email with a role: Clerk emails them the invitation
 * to the consultorio, and the role is theirs when they first come in. */
export async function inviteMemberAction(input: { email: string; role: MemberRole }) {
  return runAction(async () => {
    const { clinicId, organizationId } = await requireTeamAdmin();
    const invitation = await createInvitation(clinicId, input);
    const { userId } = await auth();
    try {
      const client = await clerkClient();
      const sent = await client.organizations.createOrganizationInvitation({
        organizationId,
        emailAddress: invitation.email,
        role: "org:member",
        inviterUserId: userId ?? undefined,
      });
      await setInvitationClerkId(invitation.id, sent.id);
    } catch (error) {
      // Already invited in Clerk (re-inviting to change the role): ours is
      // updated, and theirs still stands.
      const message = error instanceof Error ? error.message : "";
      if (!/already|duplicate/i.test(message)) {
        await deleteInvitation(clinicId, invitation.id);
        throw new Error("No se pudo enviar la invitación. Revisá el email y probá de nuevo.");
      }
    }
    revalidatePath("/dashboard/configuracion");
  });
}

export async function cancelInvitationAction(id: string) {
  return runAction(async () => {
    const { clinicId, organizationId } = await requireTeamAdmin();
    const invitation = await deleteInvitation(clinicId, id);
    if (invitation.clerkInvitationId) {
      const client = await clerkClient();
      await client.organizations
        .revokeOrganizationInvitation({ organizationId, invitationId: invitation.clerkInvitationId })
        .catch(() => {}); // already accepted or expired
    }
    revalidatePath("/dashboard/configuracion");
  });
}

export async function setMemberRoleAction(id: string, role: MemberRole) {
  return runAction(async () => {
    const { clinicId } = await requireTeamAdmin();
    await setMemberRole(clinicId, id, role);
    revalidatePath("/dashboard/configuracion");
  });
}

/** Takes someone off the team, and out of the Clerk organization. */
export async function removeMemberAction(id: string) {
  return runAction(async () => {
    const { clinicId, organizationId, me } = await requireTeamAdmin();
    if (id === me.id) throw new Error("No podés sacarte a vos mismo del equipo");
    const member = await removeMember(clinicId, id);
    const client = await clerkClient();
    await client.organizations
      .deleteOrganizationMembership({ organizationId, userId: member.clerkUserId })
      .catch(() => {}); // already gone from Clerk
    revalidatePath("/dashboard/configuracion");
  });
}

/** Links a team member to their professional profile (null unlinks). */
export async function setMemberProfessionalAction(id: string, professionalId: string | null) {
  return runAction(async () => {
    const { clinicId } = await requireTeamAdmin();
    await setMemberProfessional(clinicId, id, professionalId);
    revalidatePath("/dashboard", "layout");
  });
}
