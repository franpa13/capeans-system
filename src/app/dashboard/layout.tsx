import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/features/dashboard/components/app-sidebar";
import { UserMenu } from "@/features/dashboard/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { ClinicDataProvider } from "@/features/clinic/context/clinic-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const user = await currentUser();

  return (
    <ClinicDataProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
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
          <main className="flex flex-1 flex-col gap-4 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </ClinicDataProvider>
  );
}
