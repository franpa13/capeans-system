import Link from "next/link";
import { CalendarDays, ClipboardList, Users, Wallet } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/features/clinic/lib/format";

export function DashboardSummary({
  patientCount,
  consultationCount,
  upcomingAppointmentCount,
  pendingAmount,
}: {
  patientCount: number;
  consultationCount: number;
  upcomingAppointmentCount: number;
  pendingAmount: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Link href="/dashboard/pacientes">
        <Card className="h-full transition-colors hover:border-primary/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Pacientes</CardTitle>
            </div>
            <CardDescription>{patientCount} registrados</CardDescription>
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
            <CardDescription>{consultationCount} registradas</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Historial de tratamientos realizados.
          </CardContent>
        </Card>
      </Link>

      <Link href="/dashboard/turnos">
        <Card className="h-full transition-colors hover:border-primary/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Turnos</CardTitle>
            </div>
            <CardDescription>
              {upcomingAppointmentCount} esta semana
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Agenda y gestión de turnos.
          </CardContent>
        </Card>
      </Link>

      <Link href="/dashboard/consultas?cobro=PENDIENTE,PARCIAL">
        <Card className="h-full transition-colors hover:border-primary/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Por cobrar</CardTitle>
            </div>
            <CardDescription>{formatCurrency(pendingAmount)}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Consultas pendientes o parcialmente cobradas.
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
