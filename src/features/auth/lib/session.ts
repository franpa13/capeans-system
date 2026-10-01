import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/features/auth/lib/constants";

// Prototipo: credenciales fijas, sin base de datos.
// Cuando se conecte auth real, esto se reemplaza por una consulta a la DB.
export const MOCK_USER = {
  email: "admin@capeans.com",
  password: "demo123",
  name: "Dr. José Capeáns",
};

export async function createSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, MOCK_USER.email, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 horas
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession() {
  const cookieStore = await cookies();
  const email = cookieStore.get(SESSION_COOKIE)?.value;
  if (!email) return null;
  return { email, name: MOCK_USER.name };
}
