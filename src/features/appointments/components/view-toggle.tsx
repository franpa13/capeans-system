import Link from "next/link";
import { CalendarClock, CalendarDays, CalendarRange, List, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export type AgendaView = "day" | "week" | "month" | "list";

/** The Diario/Semanal/Mes/Lista switcher, factored out so every view renders
 * it inline in its own control row (date navigation + this toggle + the
 * status filter + "Nuevo turno"), instead of it living in a separate row
 * above. */
export function ViewToggle({
  view,
  diarioHref,
  semanalHref,
  mesHref,
  listaHref,
}: {
  view: AgendaView;
  diarioHref: string;
  semanalHref: string;
  mesHref: string;
  listaHref: string;
}) {
  const options: { value: AgendaView; label: string; href: string; icon: LucideIcon }[] = [
    { value: "day", label: "Diario", href: diarioHref, icon: CalendarClock },
    { value: "week", label: "Semanal", href: semanalHref, icon: CalendarRange },
    { value: "month", label: "Mes", href: mesHref, icon: CalendarDays },
    { value: "list", label: "Lista", href: listaHref, icon: List },
  ];
  return (
    <div className="flex gap-1 rounded-md border p-1">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={view === option.value ? "secondary" : "ghost"}
          size="sm"
          asChild
        >
          <Link href={option.href} data-active={view === option.value}>
            <option.icon />
            {option.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}
