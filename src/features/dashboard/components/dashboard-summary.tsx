"use client";

import Link from "next/link";
import { CalendarDays, ClipboardList, Users } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useClinicData } from "@/features/clinic/context/clinic-provider";

export function DashboardSummary() {
  const { patients, consultations } = useClinicData();

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Link href="/dashboard/pacientes">
        <Card className="h-full transition-colors hover:border-primary/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Pacientes</CardTitle>
            </div>
            <CardDescription>{patients.length} registrados</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Alta, búsqueda e historial de pacientes.
          </CardContent>
        </Card>
      </Link>

      <Link href="/dashboard/consultas">
        <Card className="h-full transition-colors hover:border-primary/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ClipboardList className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Consultas/Tratamientos</CardTitle>
            </div>
            <CardDescription>{consultations.length} registradas</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Historial de tratamientos realizados.
          </CardContent>
        </Card>
      </Link>

      <Card className="h-full border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Turnos</CardTitle>
          </div>
          <CardDescription>Próximamente</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Agenda y gestión de turnos.
        </CardContent>
      </Card>
    </div>
  );
}
