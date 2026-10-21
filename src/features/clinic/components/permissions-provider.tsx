"use client";

import { createContext, useContext } from "react";
import { can, type MemberRole, type Permission } from "@/features/clinic/lib/permissions";

const RoleContext = createContext<MemberRole | null>(null);

/** Gives every screen the signed-in person's role, to hide what they
 * can't use. The server checks the same rules on every action. */
export function PermissionsProvider({ role, children }: { role: MemberRole; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

/** Whether the signed-in person may do this. Outside the dashboard (no
 * provider) nothing is allowed. */
export function useCan(permission: Permission): boolean {
  const role = useContext(RoleContext);
  return role !== null && can(role, permission);
}
