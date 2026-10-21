"use client";

import { Baby, User, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ALL_TEETH, PRIMARY_TEETH, type Tooth } from "@/features/clinic/lib/odontogram";

function ToothPicker({
  id,
  teeth,
  value,
  onChange,
}: {
  id: string;
  teeth: Tooth[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const available = teeth.filter((t) => !value.includes(t.fdi));
  return (
    // Remounted on every pick (via key) so the trigger resets to its
    // placeholder instead of showing the just-added tooth as "selected" —
    // this is an adder, not a single persistent choice.
    <Select key={value.length} onValueChange={(fdi) => onChange([...value, fdi])}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Agregar una pieza" />
      </SelectTrigger>
      {/* popper (vs. the default item-aligned) anchors the list to the
          trigger and caps it to a fixed height with scroll buttons on both
          ends — item-aligned instead tries to align the selected row with
          the trigger, which for a 32-row list made it balloon upward with
          no visible way to tell, since there's rarely room above. */}
      <SelectContent position="popper" className="max-h-64">
        {available.map((t) => (
          <SelectItem key={t.fdi} value={t.fdi}>
            {t.fdi}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export type DentitionMode = "adulto" | "nino";

export function TeethField({
  id = "teeth",
  value,
  onChange,
  mode,
  onModeChange,
}: {
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
  mode: DentitionMode;
  onModeChange: (mode: DentitionMode) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Piezas dentales (opcional)</Label>
      <Tabs value={mode} onValueChange={(v) => onModeChange(v as DentitionMode)}>
        <TabsList>
          <TabsTrigger value="adulto">
            <User />
            Adulto
          </TabsTrigger>
          <TabsTrigger value="nino">
            <Baby />
            Niño
          </TabsTrigger>
        </TabsList>
        <TabsContent value="adulto">
          <ToothPicker id={id} teeth={ALL_TEETH} value={value} onChange={onChange} />
        </TabsContent>
        <TabsContent value="nino">
          <ToothPicker
            id={`${id}-primary`}
            teeth={PRIMARY_TEETH}
            value={value}
            onChange={onChange}
          />
        </TabsContent>
      </Tabs>
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
