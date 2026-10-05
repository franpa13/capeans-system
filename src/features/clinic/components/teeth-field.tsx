"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_TEETH } from "@/features/clinic/lib/odontogram";

export function TeethField({
  id = "teeth",
  value,
  onChange,
}: {
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const available = ALL_TEETH.filter((t) => !value.includes(t.fdi));

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Piezas dentales (opcional)</Label>
      {/* Remounted on every pick (via key) so the trigger resets to its
          placeholder instead of showing the just-added tooth as "selected" —
          this is an adder, not a single persistent choice. */}
      <Select key={value.length} onValueChange={(fdi) => onChange([...value, fdi])}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Agregar una pieza" />
        </SelectTrigger>
        <SelectContent>
          {available.map((t) => (
            <SelectItem key={t.fdi} value={t.fdi}>
              {t.fdi}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((fdi) => (
            <Badge key={fdi} variant="secondary" className="gap-1 pr-1">
              {fdi}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== fdi))}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Quitar pieza ${fdi}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
