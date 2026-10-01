"use server";

import { redirect } from "next/navigation";
import { loginSchema } from "@/features/auth/lib/schema";
import { createSession, destroySession, MOCK_USER } from "@/features/auth/lib/session";

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Revisá el email y la contraseña ingresados." };
  }

  const { email, password } = parsed.data;

  if (email !== MOCK_USER.email || password !== MOCK_USER.password) {
    return { error: "Email o contraseña incorrectos." };
  }

  await createSession();
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
