"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OTHER_TREATMENT } from "@/features/clinic/lib/treatments";

export const ALL_TREATMENTS = "__all__";

/** The Tratamiento/Paciente/Pieza/Desde/Hasta filter row shared by the main
 * Consultas list (filtered server-side, via URL search params) and the
 * consultations list embedded in a patient's own page (filtered in memory,
 * since it's already scoped to one patient and has no Paciente field). Pure
 * presentation — every value and change is controlled by the caller. */
export function ConsultationFilterBar({
  treatment,
  onTreatmentChange,
  treatmentOptions,
  showPatient,
  patientQuery,
  onPatientQueryChange,
  toothQuery,
  onToothQueryChange,
  from,
  onFromChange,
  to,
  onToChange,
  hasFilters,
  onClear,
}: {
  treatment: string;
  onTreatmentChange: (value: string) => void;
  treatmentOptions: string[];
  showPatient: boolean;
  patientQuery: string;
  onPatientQueryChange: (value: string) => void;
  toothQuery: string;
  onToothQueryChange: (value: string) => void;
  from: string;
  onFromChange: (value: string) => void;
  to: string;
  onToChange: (value: string) => void;
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Tratamiento</Label>
        <Select value={treatment} onValueChange={onTreatmentChange}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TREATMENTS}>Todos los tratamientos</SelectItem>
            {treatmentOptions.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
            <SelectItem value={OTHER_TREATMENT}>{OTHER_TREATMENT}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showPatient && (
        <div className="space-y-1.5">
          <Label htmlFor="filter-patient" className="text-xs text-muted-foreground">
            Paciente
          </Label>
          <Input
            id="filter-patient"
            placeholder="Buscar por nombre..."
            value={patientQuery}
            onChange={(e) => onPatientQueryChange(e.target.value)}
            className="w-full sm:w-48"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="filter-tooth" className="text-xs text-muted-foreground">
          Pieza
        </Label>
        <Input
          id="filter-tooth"
          placeholder="Ej: 16"
          value={toothQuery}
          onChange={(e) => onToothQueryChange(e.target.value)}
          className="w-full sm:w-28"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-from" className="text-xs text-muted-foreground">
          Desde
        </Label>
        <Input
          id="filter-from"
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="w-full sm:w-40"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-to" className="text-xs text-muted-foreground">
          Hasta
        </Label>
        <Input
          id="filter-to"
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="w-full sm:w-40"
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X />
          Limpiar filtros
        </Button>
      )}
    </div>
  );
}
