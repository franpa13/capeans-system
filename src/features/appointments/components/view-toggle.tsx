import Link from "next/link";

import { Button } from "@/components/ui/button";

/** The Semanal/Diario switcher, factored out so both AppointmentsCalendar
 * and DailyAgenda can render it inline in their own control row — each
 * view assembles its own complete row (date navigation + this toggle +
 * the status filter + "Nuevo turno"), per request, instead of it living
 * in a separate row above. */
export function ViewToggle({
  isDayView,
  semanalHref,
  diarioHref,
}: {
  isDayView: boolean;
  semanalHref: string;
  diarioHref: string;
}) {
  return (
    <div className="flex gap-1 rounded-md border p-1">
      <Button variant={isDayView ? "ghost" : "secondary"} size="sm" asChild>
        <Link href={semanalHref} data-active={!isDayView}>
          Semanal
        </Link>
      </Button>
      <Button variant={isDayView ? "secondary" : "ghost"} size="sm" asChild>
        <Link href={diarioHref} data-active={isDayView}>
          Diario
        </Link>
      </Button>
    </div>
  );
}
