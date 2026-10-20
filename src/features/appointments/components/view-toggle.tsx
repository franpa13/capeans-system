import Link from "next/link";

import { Button } from "@/components/ui/button";

export type AgendaView = "day" | "week" | "list";

/** The Diario/Semanal/Lista switcher, factored out so every view renders
 * it inline in its own control row (date navigation + this toggle + the
 * status filter + "Nuevo turno"), instead of it living in a separate row
 * above. */
export function ViewToggle({
  view,
  diarioHref,
  semanalHref,
  listaHref,
}: {
  view: AgendaView;
  diarioHref: string;
  semanalHref: string;
  listaHref: string;
}) {
  const options: { value: AgendaView; label: string; href: string }[] = [
    { value: "day", label: "Diario", href: diarioHref },
    { value: "week", label: "Semanal", href: semanalHref },
    { value: "list", label: "Lista", href: listaHref },
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
            {option.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}
