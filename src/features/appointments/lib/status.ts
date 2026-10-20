// Kept in a plain module, not the "use client" filter component — every
// export from a client-boundary file becomes an opaque client-reference
// proxy when imported into a Server Component, even a plain string
// constant, so turnos/page.tsx (server) and
// appointment-status-filter.tsx (client) both need to import these from
// here instead of from each other.
export const ALL_STATUSES = "ALL";
/** Every turno but cancelled ones: a turno that was done (Completado) or
 * missed (No vino) stays on the agenda with its new state — only a
 * cancelled one leaves, since its slot was freed for someone else. */
export const ACTIVE_STATUSES = "ACTIVE";
export const DEFAULT_STATUS = ACTIVE_STATUSES;

/** How each turno status reads on screen. */
export const APPOINTMENT_STATUS_LABELS = {
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  COMPLETED: "Completado",
  NO_SHOW: "No vino",
  WAITING: "En sala de espera",
} as const;
