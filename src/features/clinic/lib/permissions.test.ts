import { describe, expect, it } from "vitest";
import { PERMISSIONS, ROLE_LABELS, can, resolveNewMemberRole } from "@/features/clinic/lib/permissions";

describe("permissions", () => {
  it("lets the administrador do everything", () => {
    for (const permission of PERMISSIONS) expect(can("ADMIN", permission)).toBe(true);
  });

  it("lets the odontólogo work clinically, but not run the consultorio", () => {
    for (const p of ["clinical.view", "clinical.edit", "documents.issue", "payments.record", "agenda.manage"] as const) {
      expect(can("DENTIST", p)).toBe(true);
    }
    for (const p of ["team.manage", "settings.manage", "income.view", "patients.delete", "data.export"] as const) {
      expect(can("DENTIST", p)).toBe(false);
    }
  });

  it("keeps recepción away from the clinical record and the money totals", () => {
    for (const p of ["agenda.manage", "patients.edit", "payments.record", "stock.manage"] as const) {
      expect(can("RECEPTION", p)).toBe(true);
    }
    for (const p of ["clinical.view", "clinical.edit", "documents.issue", "income.view", "settings.manage"] as const) {
      expect(can("RECEPTION", p)).toBe(false);
    }
  });

  it("names each role in Spanish", () => {
    expect(ROLE_LABELS).toEqual({ ADMIN: "Administrador", DENTIST: "Odontólogo", RECEPTION: "Recepción" });
  });
});

describe("resolveNewMemberRole", () => {
  it("takes the role of their invitation", () => {
    expect(resolveNewMemberRole({ invitedAs: "DENTIST", clinicHasMembers: true, isOrgAdmin: false })).toBe("DENTIST");
  });

  it("makes the first person in a consultorio its administrador, so existing clinics keep working", () => {
    expect(resolveNewMemberRole({ invitedAs: null, clinicHasMembers: false, isOrgAdmin: false })).toBe("ADMIN");
  });

  it("trusts Clerk's organization admin, and otherwise gives the least access", () => {
    expect(resolveNewMemberRole({ invitedAs: null, clinicHasMembers: true, isOrgAdmin: true })).toBe("ADMIN");
    expect(resolveNewMemberRole({ invitedAs: null, clinicHasMembers: true, isOrgAdmin: false })).toBe("RECEPTION");
  });
});
