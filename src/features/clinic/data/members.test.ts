import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createInvitation,
  deleteInvitation,
  ensureMember,
  getInvitations,
  getMembers,
  removeMember,
  setMemberRole,
} from "@/features/clinic/data/members";

let clinicA: { id: string };
let clinicB: { id: string };

beforeEach(async () => {
  clinicA = await prisma.clinic.create({ data: { clerkOrgId: `org_a_${Date.now()}`, name: "Clínica A" } });
  clinicB = await prisma.clinic.create({ data: { clerkOrgId: `org_b_${Date.now()}`, name: "Clínica B" } });
});

afterEach(async () => {
  await prisma.clinicInvitation.deleteMany({});
  await prisma.clinicMember.deleteMany({});
  await prisma.clinic.deleteMany({});
});

const person = (id: string, email: string, isOrgAdmin = false) => ({
  clerkUserId: id,
  name: `Persona ${id}`,
  emails: [email],
  isOrgAdmin,
});

describe("clinic members", () => {
  it("makes the first one in the administrador and remembers them", async () => {
    const owner = await ensureMember(clinicA.id, person("u1", "duena@x.com"));
    expect(owner).toMatchObject({ role: "ADMIN", name: "Persona u1", email: "duena@x.com" });
    const again = await ensureMember(clinicA.id, { ...person("u1", "duena@x.com"), isOrgAdmin: false });
    expect(again.id).toBe(owner.id);
  });

  it("gives an invited person their invitation's role, matching any of their emails, and uses the invitation up", async () => {
    await ensureMember(clinicA.id, person("u1", "duena@x.com"));
    await createInvitation(clinicA.id, { email: " Recepcion@X.com ", role: "RECEPTION" });
    const invited = await ensureMember(clinicA.id, {
      ...person("u2", "otra@x.com"),
      emails: ["otra@x.com", "recepcion@x.com"],
    });
    expect(invited.role).toBe("RECEPTION");
    expect(await getInvitations(clinicA.id)).toEqual([]);
  });

  it("gives someone uninvited the least access, unless Clerk says they're an admin", async () => {
    await ensureMember(clinicA.id, person("u1", "duena@x.com"));
    expect((await ensureMember(clinicA.id, person("u2", "b@x.com"))).role).toBe("RECEPTION");
    expect((await ensureMember(clinicA.id, person("u3", "c@x.com", true))).role).toBe("ADMIN");
  });

  it("keeps each clinic's team apart", async () => {
    await ensureMember(clinicA.id, person("u1", "duena@x.com"));
    const inB = await ensureMember(clinicB.id, person("u1", "duena@x.com"));
    expect(inB.role).toBe("ADMIN");
    expect((await getMembers(clinicB.id)).length).toBe(1);
    await expect(setMemberRole(clinicA.id, inB.id, "RECEPTION")).rejects.toThrow();
    await expect(removeMember(clinicA.id, inB.id)).rejects.toThrow();
  });

  it("never leaves a consultorio without an administrador", async () => {
    const owner = await ensureMember(clinicA.id, person("u1", "duena@x.com"));
    const other = await ensureMember(clinicA.id, person("u2", "b@x.com"));
    await expect(setMemberRole(clinicA.id, owner.id, "DENTIST")).rejects.toThrow(
      "Tiene que quedar al menos un administrador",
    );
    await expect(removeMember(clinicA.id, owner.id)).rejects.toThrow("Tiene que quedar al menos un administrador");

    await setMemberRole(clinicA.id, other.id, "ADMIN");
    await setMemberRole(clinicA.id, owner.id, "DENTIST");
    const removed = await removeMember(clinicA.id, owner.id);
    expect(removed.clerkUserId).toBe("u1");
    expect((await getMembers(clinicA.id)).map((m) => [m.clerkUserId, m.role])).toEqual([["u2", "ADMIN"]]);
  });
});

describe("invitations", () => {
  it("are one per email, re-inviting changes the role", async () => {
    await createInvitation(clinicA.id, { email: "dr@x.com", role: "DENTIST" });
    await createInvitation(clinicA.id, { email: "DR@x.com", role: "ADMIN" });
    expect((await getInvitations(clinicA.id)).map((i) => [i.email, i.role])).toEqual([["dr@x.com", "ADMIN"]]);
  });

  it("need a valid email of someone not already in the team", async () => {
    await ensureMember(clinicA.id, person("u1", "duena@x.com"));
    await expect(createInvitation(clinicA.id, { email: "no-es-un-mail", role: "DENTIST" })).rejects.toThrow(
      "Ingresá un email válido",
    );
    await expect(createInvitation(clinicA.id, { email: "Duena@x.com", role: "DENTIST" })).rejects.toThrow(
      "Esa persona ya es parte del equipo",
    );
  });

  it("are cancelled only within their clinic", async () => {
    const invitation = await createInvitation(clinicA.id, { email: "dr@x.com", role: "DENTIST" });
    await expect(deleteInvitation(clinicB.id, invitation.id)).rejects.toThrow();
    await deleteInvitation(clinicA.id, invitation.id);
    expect(await getInvitations(clinicA.id)).toEqual([]);
  });
});
