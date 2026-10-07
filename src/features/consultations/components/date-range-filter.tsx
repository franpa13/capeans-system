"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate, toLocalDateString } from "@/features/clinic/lib/format";

/** Parses a "YYYY-MM-DD" filter value as a local-time Date — not
 * `new Date(value)`, which reads it as UTC midnight and can render as the
 * previous day in the calendar for any timezone behind UTC. */
function parseLocalDate(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** A single range-select calendar for the Desde/Hasta filters, replacing
 * two separate date inputs — closes itself once both ends of the range
 * are picked. */
export function DateRangeFilter({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const range: DateRange | undefined = {
    from: parseLocalDate(from),
    to: parseLocalDate(to),
  };

  const label = from && to
    ? `${formatDate(from)} – ${formatDate(to)}`
    : from
      ? `Desde ${formatDate(from)}`
      : to
        ? `Hasta ${formatDate(to)}`
        : "Rango de fechas";

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Fecha</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2 font-normal sm:w-64"
          >
            <CalendarIcon className="size-4 text-muted-foreground" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={range}
            onSelect={(next) => {
              const nextFrom = next?.from ? toLocalDateString(next.from) : "";
              const nextTo = next?.to ? toLocalDateString(next.to) : "";
              onChange({ from: nextFrom, to: nextTo });
              if (nextFrom && nextTo) setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
