import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ToothIcon } from "@/components/tooth-icon";
import { LoginForm } from "@/features/auth/components/login-form";
import { getSession } from "@/features/auth/lib/session";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="mx-auto w-full max-w-sm space-y-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <ToothIcon className="size-6" />
        </div>
        <h1 className="text-xl font-semibold">Capeans</h1>
        <p className="text-sm text-muted-foreground">
          Consultorio Dental — Panel de administración
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>
            Ingresá tus credenciales para acceder al panel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
