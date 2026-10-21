"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { professionalLabel, useProfessionals } from "@/features/clinic/components/permissions-provider";

const NONE = "__none__";

/** "Atendió": who did the consulta — only when the consultorio has
 * professionals loaded. "" = not said. */
export function ProfessionalPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (professionalId: string) => void;
}) {
  const professionals = useProfessionals();
  if (professionals.length === 0) return null;
  return (
    <div className="space-y-2">
      <Label htmlFor="consultationProfessional">Atendió</Label>
      <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
        <SelectTrigger id="consultationProfessional" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Sin indicar</SelectItem>
          {professionals.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {professionalLabel(p)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
