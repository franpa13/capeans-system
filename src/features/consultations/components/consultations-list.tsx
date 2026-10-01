"use client";

import { useMemo, useState } from "react";
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
import { ConsultationsTable } from "@/features/consultations/components/consultations-table";
import { OTHER_TREATMENT, TREATMENT_OPTIONS } from "@/features/clinic/lib/treatments";
import type { Consultation, Patient } from "@/features/clinic/lib/types";

const ALL_TREATMENTS = "__all__";
const KNOWN_TREATMENTS = TREATMENT_OPTIONS.filter((t) => t !== OTHER_TREATMENT);

function matchesTreatment(consultationTreatment: string, filter: string) {
  if (filter === ALL_TREATMENTS) return true;
  if (filter === OTHER_TREATMENT) {
    return !(KNOWN_TREATMENTS as readonly string[]).includes(consultationTreatment);
  }
  return consultationTreatment === filter;
}

export function ConsultationsList({
  consultations,
  patients,
  showPatient = true,
  emptyMessage = "Todavía no hay consultas registradas.",
}: {
  consultations: Consultation[];
  patients?: Patient[];
  showPatient?: boolean;
  emptyMessage?: string;
}) {
  const [treatment, setTreatment] = useState(ALL_TREATMENTS);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return consultations.filter((c) => {
      if (!matchesTreatment(c.treatment, treatment)) return false;
      if (from && c.date < from) return false;
      if (to && c.date > to) return false;
      return true;
    });
  }, [consultations, treatment, from, to]);

  const hasFilters = treatment !== ALL_TREATMENTS || !!from || !!to;

  const clearFilters = () => {
    setTreatment(ALL_TREATMENTS);
    setFrom("");
    setTo("");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tratamiento</Label>
          <Select value={treatment} onValueChange={setTreatment}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TREATMENTS}>
                Todos los tratamientos
              </SelectItem>
              {TREATMENT_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-from" className="text-xs text-muted-foreground">
            Desde
          </Label>
          <Input
            id="filter-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
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
            onChange={(e) => setTo(e.target.value)}
            className="w-full sm:w-40"
          />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X />
            Limpiar filtros
          </Button>
        )}
      </div>

      <ConsultationsTable
        consultations={filtered}
        patients={patients}
        showPatient={showPatient}
        emptyMessage={
          hasFilters
            ? "No hay consultas que coincidan con los filtros."
            : emptyMessage
        }
      />
    </div>
  );
}
