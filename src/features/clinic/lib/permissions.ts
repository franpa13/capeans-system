// Who in a consultorio can do what. Checked on the server by every action
// (requirePermission) and used by the screens to hide what a role can't
// use. One table, so the rules live in a single place.

export type MemberRole = "ADMIN" | "DENTIST" | "RECEPTION";

export const ROLES: MemberRole[] = ["ADMIN", "DENTIST", "RECEPTION"];

export const ROLE_LABELS: Record<MemberRole, string> = {
  ADMIN: "Administrador",
  DENTIST: "Odontólogo",
  RECEPTION: "Recepción",
};

export const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  ADMIN: "Todo, incluidos ingresos, configuración y equipo.",
  DENTIST: "Agenda, pacientes, historia clínica, consultas, recetas y órdenes.",
  RECEPTION: "Agenda, datos de pacientes, cobros y stock. No ve la historia clínica ni los ingresos.",
};

export const PERMISSIONS = [
  /** Invite people, change roles. */
  "team.manage",
  /** Configuración: obras sociales, tratamientos, horarios, profesionales. */
  "settings.manage",
  /** Ingresos and money totals. */
  "income.view",
  /** Download patients, consultas, ingresos, stock as Excel. */
  "data.export",
  "data.import",
  "patients.delete",
  /** Historia clínica: ficha médica, consultas, odontograma, estudios, recetas, órdenes. */
  "clinical.view",
  /** Register and edit consultas, hallazgos, estudios. */
  "clinical.edit",
  /** Recetas and órdenes. */
  "documents.issue",
  /** Charge consultas (payments). */
  "payments.record",
  /** Patients' personal data and observaciones. */
  "patients.edit",
  /** Turnos, bloqueos, recordatorios. */
  "agenda.manage",
  "stock.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<MemberRole, ReadonlySet<Permission>> = {
  ADMIN: new Set(PERMISSIONS),
  DENTIST: new Set<Permission>([
    "clinical.view",
    "clinical.edit",
    "documents.issue",
    "payments.record",
    "patients.edit",
    "agenda.manage",
    "stock.manage",
  ]),
  RECEPTION: new Set<Permission>(["payments.record", "patients.edit", "agenda.manage", "stock.manage"]),
};

export function can(role: MemberRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/** The role of someone entering a consultorio for the first time: their
 * invitation's; the administrador if they're the first one in (so every
 * consultorio that predates roles keeps its owner in charge); Clerk's
 * organization admin; otherwise the least access. */
export function resolveNewMemberRole({
  invitedAs,
  clinicHasMembers,
  isOrgAdmin,
}: {
  invitedAs: MemberRole | null;
  clinicHasMembers: boolean;
  isOrgAdmin: boolean;
}): MemberRole {
  if (invitedAs) return invitedAs;
  if (!clinicHasMembers || isOrgAdmin) return "ADMIN";
  return "RECEPTION";
}
