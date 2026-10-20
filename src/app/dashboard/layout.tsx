import { auth, currentUser } from "@clerk/nextjs/server";
import { SignOutButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/features/dashboard/components/app-sidebar";
import { UserMenu } from "@/features/dashboard/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  getCurrentClinic,
  getDashboardAccessMessage,
} from "@/features/clinic/data/current-clinic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  const user = await currentUser();
  const clinic = await getCurrentClinic();

  if (!clinic) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground">
          {getDashboardAccessMessage(orgId)}
        </p>
        <SignOutButton redirectUrl="/sign-in">
          <Button variant="outline">Cerrar sesión</Button>
        </SignOutButton>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar clinicName={clinic.name} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-2 md:px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <span className="text-sm font-medium">Panel</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserMenu
              name={user?.fullName ?? "Usuario"}
              email={user?.primaryEmailAddress?.emailAddress ?? ""}
            />
          </div>
        </header>
        <main className="flex min-w-0 flex-1 flex-col gap-4 p-2 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
