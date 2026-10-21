"use client";

import { createContext, useContext } from "react";
import { can, type MemberRole, type Permission } from "@/features/clinic/lib/permissions";

export type ProfessionalChoice = { id: string; title: string; name: string };

type Session = {
  role: MemberRole;
  /** The signed-in person's own professional profile, if they're a dentist. */
  professionalId: string | null;
  /** The consultorio's professionals, for "who attends" pickers. */
  professionals: ProfessionalChoice[];
};

const SessionContext = createContext<Session | null>(null);

/** Gives every screen the signed-in person's role and professional, and
 * the consultorio's professionals. The server checks the same permissions
 * on every action. */
export function PermissionsProvider({ children, ...session }: Session & { children: React.ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

/** Whether the signed-in person may do this. Outside the dashboard (no
 * provider) nothing is allowed. */
export function useCan(permission: Permission): boolean {
  const session = useContext(SessionContext);
  return session !== null && can(session.role, permission);
}

export function useProfessionals(): ProfessionalChoice[] {
  return useContext(SessionContext)?.professionals ?? [];
}

/** Who a new turno, consulta or receta is for by default: the signed-in
 * dentist, or the consultorio's only professional. */
export function useDefaultProfessionalId(): string | null {
  const session = useContext(SessionContext);
  if (!session) return null;
  if (session.professionalId) return session.professionalId;
  return session.professionals.length === 1 ? session.professionals[0].id : null;
}

export const professionalLabel = (p: ProfessionalChoice) => `${p.title} ${p.name}`;

/** "Dra. Moretti" for a professional id — for agenda cards, only worth
 * showing when there's more than one professional. */
export function useProfessionalShortName(): (id: string | null | undefined) => string | null {
  const professionals = useProfessionals();
  return (id) => {
    if (!id || professionals.length < 2) return null;
    const p = professionals.find((x) => x.id === id);
    if (!p) return null;
    const words = p.name.trim().split(/\s+/);
    return `${p.title} ${words[words.length - 1]}`;
  };
}
