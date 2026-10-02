"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NO_INSURANCE, OTHER_INSURANCE } from "@/features/clinic/lib/insurance";

export function InsuranceField({
  id = "insurance",
  value,
  onChange,
  otherValue,
  onOtherChange,
  error,
  otherError,
  options,
}: {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  otherValue?: string;
  onOtherChange: (value: string) => void;
  error?: string;
  otherError?: string;
  options: string[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Obra social</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Seleccioná (opcional)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_INSURANCE}>{NO_INSURANCE}</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
          <SelectItem value={OTHER_INSURANCE}>{OTHER_INSURANCE}</SelectItem>
        </SelectContent>
      </Select>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {value === OTHER_INSURANCE && (
        <div className="space-y-2 pt-1">
          <Input
            placeholder="Nombre de la obra social"
            value={otherValue ?? ""}
            onChange={(e) => onOtherChange(e.target.value)}
            aria-invalid={!!otherError}
          />
          {otherError && (
            <p className="text-sm text-destructive">{otherError}</p>
          )}
        </div>
      )}
    </div>
  );
}
