"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import {
  Banknote,
  Boxes,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useCan } from "@/features/clinic/components/permissions-provider";
import type { Permission } from "@/features/clinic/lib/permissions";

const navItems: { title: string; url: string; icon: typeof Users; permission?: Permission }[] = [
  { title: "Inicio", url: "/dashboard", icon: LayoutDashboard },
  { title: "Pacientes", url: "/dashboard/pacientes", icon: Users },
  { title: "Consultas/Tratamientos", url: "/dashboard/consultas", icon: ClipboardList },
  { title: "Ingresos", url: "/dashboard/ingresos", icon: Banknote, permission: "income.view" },
  { title: "Turnos", url: "/dashboard/turnos", icon: CalendarDays },
  { title: "Stock", url: "/dashboard/stock", icon: Boxes },
  { title: "Configuración", url: "/dashboard/configuracion", icon: Settings, permission: "settings.manage" },
];

function isNavItemActive(pathname: string, url: string) {
  return url === "/dashboard" ? pathname === url : pathname.startsWith(url);
}

export function AppSidebar({ clinicName }: { clinicName?: string }) {
  const canIncome = useCan("income.view");
  const canSettings = useCan("settings.manage");
  const allowed = (permission?: Permission) =>
    !permission || (permission === "income.view" ? canIncome : canSettings);
  const pathname = usePathname();
  const { signOut } = useClerk();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Image
            src="/dentia-mark.png"
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 object-contain"
            priority
          />
          <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold">Dentia</span>
            <span className="truncate text-xs text-muted-foreground">
              {clinicName ?? "Consultorio Dental"}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.filter((item) => allowed(item.permission)).map((item) =>
                item.url ? (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isNavItemActive(pathname, item.url)}
                      tooltip={item.title}
                    >
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton disabled tooltip={item.title}>
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge>Próximamente</SidebarMenuBadge>
                  </SidebarMenuItem>
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Cerrar sesión"
              onClick={() => signOut({ redirectUrl: "/sign-in" })}
            >
              <LogOut />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
