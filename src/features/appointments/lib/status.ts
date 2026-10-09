// Kept in a plain module, not the "use client" filter component — every
// export from a client-boundary file becomes an opaque client-reference
// proxy when imported into a Server Component, even a plain string
// constant, so turnos/page.tsx (server) and
// appointment-status-filter.tsx (client) both need to import these from
// here instead of from each other.
export const ALL_STATUSES = "ALL";
export const DEFAULT_STATUS = "CONFIRMED";
